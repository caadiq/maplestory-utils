import { useEffect, useRef, useCallback } from 'react'
import { normalize } from './locateCore'
import { MARK, toMagenta, toLuma } from './runeMarkCore'

/**
 * 화면 공유 스트림에서 **미니맵의 룬 표식**(자홍 마름모)을 지켜본다.
 *
 * 문구 감지(useRuneDetector)와 나란히 돈다. 둘 중 하나만 잡아도 알린다 —
 * 서로 막히는 상황이 다르기 때문이다(runeMarkCore.js 머리말 참고).
 *
 * 미니맵은 사용자가 옮길 수 있고 맵에 따라 크기도 변한다. 그래서 자리를 먼저 찾고,
 * 못 찾거나 어긋나면 사용자가 직접 지정할 수 있게 열어 둔다.
 */

const tplFiles = import.meta.glob('./minimap/*.png', { eager: true, query: '?url', import: 'default' })
const urlOf = (part) => Object.entries(tplFiles).find(([p]) => p.includes(part))?.[1] ?? null

/** 표식을 훑어볼 배율 (템플릿은 1080p 캡처에서 떴다) */
const MARK_SCALES = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]

/** 자리를 못 찾았을 때 다시 시도하는 간격 */
const RELOCATE_MS = 15000

/* ── 워커 ────────────────────────────────────────────────── */

let markWorker = null
let markSeq = 0
function runOp(op, payload, fallback) {
  if (typeof Worker === 'undefined') return Promise.resolve(fallback())
  try {
    if (!markWorker) {
      markWorker = new Worker(new URL('./runemark.worker.js', import.meta.url), { type: 'module' })
    }
  } catch {
    return Promise.resolve(fallback())
  }
  const id = ++markSeq
  const worker = markWorker
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
      if (e.data.error) console.warn('runemark worker:', e.data.error)
      finish(e.data.result ?? null)
    }
    /*
     * 워커 스크립트 로드 실패(배포 후 낡은 탭의 청크 404 등)는 throw가 아니라
     * error 이벤트로만 온다. 안 받으면 Promise가 안 끝나 감지가 조용히 멈춘다.
     */
    const onError = () => {
      worker.terminate()
      if (markWorker === worker) markWorker = null
      finish(fallback())
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    // 무응답 안전장치 — 워커를 끊어야 다음 스캔이 밀리지 않는다 (useJanusDetector 참고)
    timer = setTimeout(() => {
      worker.terminate()
      if (markWorker === worker) markWorker = null
      finish(null)
    }, 15000)
    worker.postMessage({ id, op, payload })
  })
}

/* ── 훅 ──────────────────────────────────────────────────── */

export function useRuneMarkDetector({ videoRef, stream, enabled, region, onRune, onRegion, onStatus }) {
  const cbRef = useRef({ onRune, onRegion, onStatus })
  useEffect(() => { cbRef.current = { onRune, onRegion, onStatus } })

  const regionRef = useRef(region)
  useEffect(() => { regionRef.current = region }, [region])

  const tplRef = useRef(null)
  const busyRef = useRef(false)
  const suppressUntilRef = useRef(0)
  /** 직전 스캔에서 본 표식 — 같은 자리에서 두 번 봐야 인정한다 */
  const lastSeenRef = useRef(null)
  const nextLocateRef = useRef(0)

  /** 템플릿(앵커·표식)을 배율별로 만들어 둔다 — 원본이 안 바뀌므로 한 번이면 된다 */
  const buildTemplates = useCallback(async () => {
    const load = (url) => new Promise((res) => {
      if (!url) return res(null)
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => res(null)
      img.src = url
    })
    const [anchorImg, markImg] = await Promise.all([
      load(urlOf('anchor-icons')), load(urlOf('rune-mark')),
    ])
    if (!anchorImg || !markImg) return null

    const canvas = document.createElement('canvas')
    const vecAt = (img, w, h, plane) => {
      canvas.width = w
      canvas.height = h
      const c = canvas.getContext('2d', { willReadFrequently: true })
      c.clearRect(0, 0, w, h)
      c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h)
      return normalize(plane(c.getImageData(0, 0, w, h).data))
    }

    const marks = []
    for (const s of MARK_SCALES) {
      const n = Math.max(6, Math.round(markImg.naturalWidth * s))
      const magVec = vecAt(markImg, n, n, toMagenta)
      const lumaVec = vecAt(markImg, n, n, toLuma)
      if (magVec && lumaVec) marks.push({ magVec, lumaVec, size: n })
    }
    return { anchorImg, marks }
  }, [])

  /** 화면 배율에 맞춘 앵커 템플릿 — 축소 화면 비율(ratio)이 바뀌면 다시 만든다 */
  const buildAnchors = useCallback((img, ratio) => {
    const canvas = document.createElement('canvas')
    const vecAt = (w, h) => {
      canvas.width = w
      canvas.height = h
      const c = canvas.getContext('2d', { willReadFrequently: true })
      c.clearRect(0, 0, w, h)
      c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h)
      return normalize(toLuma(c.getImageData(0, 0, w, h).data))
    }
    const out = []
    for (const scale of MARK.anchorScales) {
      const w = Math.max(6, Math.round(img.naturalWidth * scale))
      const h = Math.max(6, Math.round(img.naturalHeight * scale))
      const cw = Math.max(5, Math.round(w * ratio))
      const ch = Math.max(5, Math.round(h * ratio))
      const vec = vecAt(w, h)
      const coarseVec = vecAt(cw, ch)
      if (vec && coarseVec) out.push({ scale, vec, w, h, coarseVec, cw, ch })
    }
    return out
  }, [])

  useEffect(() => {
    if (!stream || !enabled) {
      cbRef.current.onStatus?.(null)
      return
    }
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let alive = true
    let anchorsKey = ''
    let anchors = null

    /** 화면을 주어진 폭으로 줄여 RGBA로 꺼낸다 */
    const grab = (w, h, sx = 0, sy = 0, sw = null, sh = null) => {
      canvas.width = w
      canvas.height = h
      try {
        ctx.drawImage(video, sx, sy, sw ?? video.videoWidth, sh ?? video.videoHeight, 0, 0, w, h)
        return { data: ctx.getImageData(0, 0, w, h).data, w, h }
      } catch {
        return null
      }
    }

    const locate = async (tpl, vw, vh) => {
      const ratio = 640 / vw
      const key = `${vw}x${vh}`
      if (anchorsKey !== key) {
        anchors = buildAnchors(tpl.anchorImg, ratio)
        anchorsKey = key
      }
      if (!anchors?.length) return null
      const coarse = grab(640, Math.round(vh * ratio))
      const full = grab(vw, vh)
      if (!coarse || !full) return null
      return runOp('locate', { coarse, full, anchors, ratio },
        () => null) // 워커가 없으면 이번엔 건너뛴다 — 전체 화면 탐색이라 메인 스레드에서 돌리면 걸린다
    }

    const scan = async () => {
      if (!alive || busyRef.current) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      let tpl = tplRef.current
      if (!tpl) {
        tpl = await buildTemplates()
        if (!alive) return
        if (!tpl) return
        tplRef.current = tpl
      }

      // 1) 지도 영역 확보 — 사용자가 지정했으면 그걸 쓰고, 없으면 스스로 찾는다
      let box = regionRef.current
      if (!box) {
        if (Date.now() < nextLocateRef.current) return
        busyRef.current = true
        let found = null
        try {
          found = await locate(tpl, vw, vh)
        } finally {
          busyRef.current = false
        }
        if (!alive) return
        nextLocateRef.current = Date.now() + RELOCATE_MS
        if (!found) {
          cbRef.current.onStatus?.({ reason: 'nomap' })
          return
        }
        box = {
          x: found.box.x / vw, y: found.box.y / vh,
          w: found.box.w / vw, h: found.box.h / vh,
        }
        cbRef.current.onRegion?.(box, { auto: true, score: found.score })
      }

      if (Date.now() < suppressUntilRef.current) return

      // 2) 지도 영역만 잘라 표식을 찾는다
      const sx = Math.round(box.x * vw)
      const sy = Math.round(box.y * vh)
      const sw = Math.round(box.w * vw)
      const sh = Math.round(box.h * vh)
      if (sw < 20 || sh < 20) return
      const band = grab(sw, sh, sx, sy, sw, sh)
      if (!band || !alive) return

      busyRef.current = true
      let hit = null
      try {
        hit = await runOp('scan', { band, marks: tpl.marks }, () => null)
      } finally {
        busyRef.current = false
      }
      if (!alive) return

      if (!hit || hit.score < MARK.threshold) {
        lastSeenRef.current = null
        cbRef.current.onStatus?.({ reason: 'watching' })
        return
      }

      /*
       * 같은 자리에서 연달아 두 번 봐야 인정한다. 통과선과 오탐 최고점 사이가
       * 0.08밖에 안 되는데, 표식은 가만히 있고 이펙트성 오탐은 한 프레임 스친다.
       */
      const prev = lastSeenRef.current
      lastSeenRef.current = hit
      if (!prev || Math.abs(prev.x - hit.x) > MARK.repeatWithinPx || Math.abs(prev.y - hit.y) > MARK.repeatWithinPx) {
        cbRef.current.onStatus?.({ reason: 'maybe', score: hit.score })
        return
      }
      suppressUntilRef.current = Date.now() + MARK.suppressMs
      lastSeenRef.current = null
      cbRef.current.onRune?.({ score: hit.score, source: 'minimap' })
    }

    const timer = setInterval(scan, MARK.scanIntervalMs)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [stream, enabled, videoRef, buildTemplates, buildAnchors])
}
