import { useEffect, useRef, useCallback } from 'react'
import { normalize } from './locateCore'
import { RUNE, toGreen, runeTemplateScale, runeScaleCandidates, scanRuneBand } from './runeCore'
import { measuredUiScale } from './uiCalibration'

/**
 * 화면 공유 스트림에서 "룬이 등장 했습니다!" 문구를 지켜본다.
 *
 * 야누스 감지와 독립이다 — 아이콘 영역을 지정하지 않았어도 공유만 켜져 있으면 돈다.
 * 상단 띠를 2초마다 워커에서 훑고, 통과선(RUNE.threshold)을 넘으면 onRune을 부른다.
 * 문구가 4~5초 떠 있으므로 한 번 울린 뒤 잠시 억제해 같은 룬로 연타되지 않게 한다.
 */

/**
 * 검증 때 쓴 원본 그대로를 빌드에 싣는다 (rune/ 폴더).
 * 일반룬과 축복룬은 문구 글꼴 크기가 다르다 — 축복룬 문장이 길어 작게 렌더된다 —
 * 그래서 템플릿이 종류별로 하나씩 필요하다.
 */
const tplFiles = import.meta.glob('./rune/*.png', { eager: true, query: '?url', import: 'default' })

const KIND_LABELS = { normal: '룬', bless: '축복의 룬' }
export const runeKindLabel = (kind) => KIND_LABELS[kind] ?? '룬'

/** 탐색 워커 — 못 만들면 같은 계산을 제자리에서 돈다 */
let runeWorker = null
let runeSeq = 0
function runScan(band, templates) {
  if (typeof Worker === 'undefined') return Promise.resolve(scanRuneBand(band, templates))
  try {
    if (!runeWorker) {
      runeWorker = new Worker(new URL('./rune.worker.js', import.meta.url), { type: 'module' })
    }
  } catch {
    return Promise.resolve(scanRuneBand(band, templates))
  }
  const id = ++runeSeq
  const worker = runeWorker
  return new Promise((resolve) => {
    let timer = null
    const finish = (v) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      clearTimeout(timer)
      resolve(v)
    }
    const onMessage = (e) => {
      if (e.data?.id !== id) return
      if (e.data.error) console.warn('rune worker:', e.data.error)
      finish(e.data.hit ?? null)
    }
    /*
     * 워커 스크립트 로드 실패(배포 후 낡은 탭의 청크 404 등)는 throw가 아니라
     * error 이벤트로만 온다. 안 받으면 Promise가 영원히 안 끝나 busy가 잠긴 채
     * 감지가 조용히 영구 정지한다. 그 자리에서 직접 계산으로 대체한다.
     */
    const onError = () => {
      worker.terminate()
      if (runeWorker === worker) runeWorker = null
      finish(scanRuneBand(band, templates))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    // 무응답 안전장치 — 워커를 끊어야 다음 스캔이 밀리지 않는다 (useJanusDetector 참고)
    timer = setTimeout(() => {
      worker.terminate()
      if (runeWorker === worker) runeWorker = null
      finish(null)
    }, 10000)
    worker.postMessage({ id, band, templates })
  })
}

export function useRuneDetector({ videoRef, stream, enabled, onRune }) {
  const cbRef = useRef(onRune)
  useEffect(() => { cbRef.current = onRune })

  // 템플릿 벡터는 배율 후보에 따라 달라진다 — 후보 조합이 같으면 한 번만 만든다
  const tplCacheRef = useRef({ key: '', promise: null })
  const suppressUntilRef = useRef(0)
  const busyRef = useRef(false)
  /*
   * 성공한 배율은 고정한다. 확장 UI 대응으로 배율 후보가 여럿이 됐는데,
   * 한 번 맞은 배율은 창이 바뀌기 전까지 그대로라 다시 다 훑을 이유가 없다.
   */
  const lockedScaleRef = useRef(null)

  const buildTemplates = useCallback(async (scales) => {
    const out = []
    for (const [path, url] of Object.entries(tplFiles)) {
      const kind = path.includes('bless') ? 'bless' : 'normal'
      const img = new Image()
      img.src = url
      await img.decode().catch(() => {})
      if (!img.naturalWidth) continue
      for (const scale of scales) {
        const tw = Math.max(8, Math.round(img.naturalWidth * scale))
        const th = Math.max(8, Math.round(img.naturalHeight * scale))
        const c = document.createElement('canvas')
        c.width = tw
        c.height = th
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, tw, th)
        const vec = normalize(toGreen(ctx.getImageData(0, 0, tw, th).data))
        if (vec) out.push({ vec, tw, th, kind, scale })
      }
    }
    return out
  }, [])

  useEffect(() => {
    if (!stream || !enabled) return

    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let alive = true

    const scan = async () => {
      if (!alive || busyRef.current) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return
      if (Date.now() < suppressUntilRef.current) return

      const scales = runeScaleCandidates(runeTemplateScale(vh), measuredUiScale(vw, vh))
      const key = scales.join(',')
      if (tplCacheRef.current.key !== key) {
        tplCacheRef.current = { key, promise: buildTemplates(scales) }
        lockedScaleRef.current = null // 후보가 달라졌으면(창·실측 변경) 고정도 무효
      }
      let templates = null
      try {
        templates = await tplCacheRef.current.promise
      } catch {
        templates = null
      }
      if (!templates?.length) {
        // 실패(이미지 로드 불발 → 빈 배열)를 캐시에 남기면 새로고침 전까지 감지가 죽는다.
        // 캐시를 비워 다음 스캔이 다시 시도하게 한다
        tplCacheRef.current = { key: '', promise: null }
        return
      }
      if (lockedScaleRef.current != null) {
        templates = templates.filter((t) => t.scale === lockedScaleRef.current)
      }
      if (!alive) return

      const b = RUNE.band
      const sx = Math.round(b.x0 * vw)
      const sy = Math.round(b.y0 * vh)
      const sw = Math.round((b.x1 - b.x0) * vw)
      const sh = Math.round((b.y1 - b.y0) * vh)
      if (canvas.width !== sw || canvas.height !== sh) {
        canvas.width = sw
        canvas.height = sh
      }
      let band
      try {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
        band = { data: ctx.getImageData(0, 0, sw, sh).data, w: sw, h: sh }
      } catch {
        return // 프레임이 아직 준비 안 됨
      }

      busyRef.current = true
      try {
        const hit = await runScan(band, templates)
        if (alive && hit && hit.score >= RUNE.threshold) {
          if (hit.scale != null) lockedScaleRef.current = hit.scale
          suppressUntilRef.current = Date.now() + RUNE.suppressMs
          cbRef.current?.(hit)
        }
      } finally {
        busyRef.current = false
      }
    }

    const timer = setInterval(scan, RUNE.scanIntervalMs)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [stream, enabled, videoRef, buildTemplates])
}
