import { useEffect, useRef, useCallback } from 'react'
import { normalize } from './locateCore'
import { BOOSTER, DIGIT_CELLS, SCALE_STEPS, toLuma, boosterScale, scanBooster } from './boosterCore'
import { uiScale } from './locateCore'
import { measuredUiScale } from './uiCalibration'

/**
 * 화면 공유 스트림에서 VIP 부스터의 "남은시간" 박스를 지켜보다가 0초에 알린다.
 *
 * 소리는 **미리 예약**한다. 남은 초를 읽는 순간 종료 시각이 확정되므로,
 * 마지막 순간에 이펙트나 인벤토리 창이 박스를 가려도 정시에 울린다.
 * (그래서 onSchedule은 "delaySec 뒤에 울려달라"는 예약 요청이고, 취소 함수를 돌려받는다)
 *
 * 야누스·룬 감지와 독립이다 — 아이콘 영역을 지정하지 않았어도 공유만 켜져 있으면 돈다.
 */

import labelUrl from './booster/label.png'
import digitsUrl from './booster/digits.png'

/** 스프라이트 한 장에 0~9가 가로로 이어져 있다 */
const DIGIT_COUNT = 10

/**
 * 읽은 값이 이만큼 어긋나야 예약을 다시 잡는다.
 * 정수부만 읽으므로 매 스캔 ±0.5초씩 흔들리는데, 그때마다 재예약하면
 * 울리기 직전에 취소·재생성이 반복돼 소리가 씹힐 수 있다.
 */
const RESCHEDULE_TOLERANCE_MS = 1500

/** 탐색 워커 — 못 만들면 같은 계산을 제자리에서 돈다 */
let boosterWorker = null
let boosterSeq = 0
function runScan(band, variants, lockedScale) {
  if (typeof Worker === 'undefined') return Promise.resolve(scanBooster(band, variants, lockedScale))
  try {
    if (!boosterWorker) {
      boosterWorker = new Worker(new URL('./booster.worker.js', import.meta.url), { type: 'module' })
    }
  } catch {
    return Promise.resolve(scanBooster(band, variants, lockedScale))
  }
  const id = ++boosterSeq
  const worker = boosterWorker
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
      if (e.data.error) console.warn('booster worker:', e.data.error)
      finish(e.data.hit ?? null)
    }
    /*
     * 워커 스크립트 로드 실패(배포 후 낡은 탭의 청크 404 등)는 throw가 아니라
     * error 이벤트로만 온다. 안 받으면 이 Promise가 영원히 안 끝나고,
     * busy 플래그가 잠긴 채 감지가 조용히 영구 정지한다. 그 자리에서 직접 계산으로 대체한다.
     */
    const onError = () => {
      worker.terminate()
      if (boosterWorker === worker) boosterWorker = null
      finish(scanBooster(band, variants, lockedScale))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    timer = setTimeout(() => finish(null), 10000) // 무응답 안전장치 — busy 잠금 방지
    worker.postMessage({ id, band, variants, lockedScale })
  })
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
})

export function useBoosterDetector({ videoRef, stream, enabled, soundSignature, onSchedule, onDetect, onStatus }) {
  const cbRef = useRef({ onSchedule, onDetect, onStatus })
  useEffect(() => { cbRef.current = { onSchedule, onDetect, onStatus } })

  // 템플릿은 화면 세로 크기에 따라 배율이 달라진다 — 크기별로 한 번만 만든다
  const tplCacheRef = useRef({ key: '', promise: null })
  const busyRef = useRef(false)
  // 지금 예약된 종료 시각과 그 취소 함수
  const endAtRef = useRef(0)
  const cancelRef = useRef(null)
  const lockedScaleRef = useRef(null)

  /*
   * base = 템플릿(1080p 실측)을 현재 화면에 맞출 절대 배율.
   * 세로 크기 예측(boosterScale)은 확장 UI에서 크게 어긋난다 — 야누스 아이콘에서
   * 실측한 UI 배율이 있으면 그걸 쓴다(아이콘 기본 32px 고정이라 가장 정확).
   */
  const buildTemplates = useCallback(async (bases) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const grab = (img, sx, sy, sw, sh, dw, dh) => {
      canvas.width = dw
      canvas.height = dh
      ctx.clearRect(0, 0, dw, dh)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
      return normalize(toLuma(ctx.getImageData(0, 0, dw, dh).data))
    }

    const [labelImg, digitsImg] = await Promise.all([loadImage(labelUrl), loadImage(digitsUrl)])
    const cellW = digitsImg.naturalWidth / DIGIT_COUNT
    const cellH = digitsImg.naturalHeight

    /*
     * 배율 후보마다 템플릿 한 벌씩. 게임 창을 통째로 공유하면 제목 표시줄이 섞여
     * 캡처 세로 크기로 계산한 배율이 실제와 어긋나므로, 화면에서 제일 잘 맞는 배율을 고른다.
     * 한 번 만들어두고 계속 쓰므로(해상도가 바뀔 때만 다시 만든다) 만드는 비용은 문제되지 않는다.
     */
    const variants = []
    const seen = new Set()
    for (const base of bases) {
    for (const step of SCALE_STEPS) {
      const sc = base * step
      // 기준이 여럿이면 배율이 겹칠 수 있다 — 같은 배율 템플릿을 두 번 만들 이유가 없다
      if (seen.has(Math.round(sc * 1000))) continue
      seen.add(Math.round(sc * 1000))
      const tw = Math.max(8, Math.round(labelImg.naturalWidth * sc))
      const th = Math.max(8, Math.round(labelImg.naturalHeight * sc))
      const labelVec = grab(labelImg, 0, 0, labelImg.naturalWidth, labelImg.naturalHeight, tw, th)
      if (!labelVec) continue

      const dw = Math.max(6, Math.round(cellW * sc))
      const dh = Math.max(6, Math.round(cellH * sc))
      const digits = []
      for (let d = 0; d < DIGIT_COUNT; d++) {
        const vec = grab(digitsImg, d * cellW, 0, cellW, cellH, dw, dh)
        if (vec) digits.push({ digit: d, vec })
      }
      if (digits.length !== DIGIT_COUNT) continue

      const px = (v) => Math.round(v * sc)
      variants.push({
        // 배율은 절대값으로 기억한다 — base가 실측/예측 어느 쪽이든 고정 배율과 비교 가능
        scale: Math.round(sc * 1000) / 1000,
        // 각 기준의 대표(step 1.0)는 1단계 라벨 탐색에도 쓰인다
        probe: step === 1,
        label: { vec: labelVec, tw, th },
        digits,
        cells: {
          tens: { dx: px(DIGIT_CELLS.tens.dx), dy: px(DIGIT_CELLS.tens.dy), w: dw, h: dh },
          ones: { dx: px(DIGIT_CELLS.ones.dx), dy: px(DIGIT_CELLS.ones.dy), w: dw, h: dh },
        },
      })
    }
    }
    if (!variants.length) return null
    // 첫 기준 배율순 정렬 (1단계 탐색은 probe 표시된 대표들로 한다)
    variants.sort((a, b) => Math.abs(a.scale - bases[0]) - Math.abs(b.scale - bases[0]))
    return variants
  }, [])

  // 공유가 끊기거나 기능을 끄면 예약도 거둔다
  useEffect(() => {
    if (stream && enabled) return
    cancelRef.current?.()
    cancelRef.current = null
    endAtRef.current = 0
  }, [stream, enabled])

  // 페이지를 떠날 때도 거둔다 — 예약은 오디오 하드웨어 시계에 걸려 있어서
  // 언마운트로 화면이 다 정리된 뒤에도 그대로 울린다 (야누스 알림에서 실제로 겪은 버그)
  useEffect(() => () => {
    cancelRef.current?.()
    cancelRef.current = null
  }, [])

  /*
   * 소리·크기를 바꾸면 진행 중인 예약을 새 설정으로 다시 단다.
   * 예약은 만드는 순간 음원·볼륨이 확정되는데, 남은 시각은 그대로라 다음 스캔이
   * 허용 오차에 걸려 재예약해 주지도 않는다 — 바꾼 소리는 여기서만 반영된다.
   */
  const sigRef = useRef(soundSignature)
  useEffect(() => {
    if (sigRef.current === soundSignature) return
    sigRef.current = soundSignature
    if (!cancelRef.current) return
    cancelRef.current()
    cancelRef.current = endAtRef.current > Date.now()
      ? (cbRef.current.onSchedule?.((endAtRef.current - Date.now()) / 1000) ?? null)
      : null
  }, [soundSignature])

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

      const measured = measuredUiScale(vw, vh)
      // 실측이 없으면 예측(비례)과 기본 UI(1.0) 두 기준을 함께 본다 — 확장 UI 대비
      const bases = measured != null
        ? [measured / uiScale(1080)]
        : [...new Set([boosterScale(vh), Math.round(1000 / uiScale(1080)) / 1000])]
      const key = `${vh}|${bases.map((b) => b.toFixed(3)).join(',')}`
      if (tplCacheRef.current.key !== key) {
        tplCacheRef.current = { key, promise: buildTemplates(bases) }
        lockedScaleRef.current = null // 기준이 달라졌으면(창·실측 변경) 고정 배율도 무효
      }
      let variants = null
      try {
        variants = await tplCacheRef.current.promise
      } catch {
        variants = null
      }
      if (!variants?.length) {
        // 실패를 캐시에 남기면 일시적 네트워크 오류 한 번이 새로고침 전까지 기능을 죽인다.
        // 캐시를 비워 다음 스캔이 다시 시도하게 한다 (alarm.js의 buffers.delete와 같은 원칙)
        tplCacheRef.current = { key: '', promise: null }
        return
      }
      if (!alive) return

      const b = BOOSTER.band
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
      let hit = null
      try {
        hit = await runScan(band, variants, lockedScaleRef.current)
      } finally {
        busyRef.current = false
      }
      if (!alive) return

      // 어디까지 갔는지 매번 알려준다 — 화면에 상태로 띄워 원인을 볼 수 있게
      // 맞는 배율을 찾았으면 기억해 다음부터 그 배율로 먼저 본다
      if (hit?.scale) lockedScaleRef.current = hit.scale
      cbRef.current.onStatus?.({
        reason: hit?.reason ?? 'none',
        seconds: hit?.seconds ?? null,
        labelScore: hit?.labelScore ?? 0,
        digitScore: hit?.digitScore ?? null,
        scale: hit?.scale ?? null,
      })
      if (!hit || hit.seconds == null) return

      /*
       * 정수부만 읽으므로 실제 남은 시간은 [n, n+1)이다. 가운데인 +0.5초를 종료로 본다.
       * 최대 오차 0.5초 — 부스터를 이어 쓰는 데는 1분 가까운 여유가 있어 문제되지 않는다.
       */
      const endAt = Date.now() + hit.seconds * 1000 + 500
      if (Math.abs(endAt - endAtRef.current) <= RESCHEDULE_TOLERANCE_MS) return

      cancelRef.current?.()
      endAtRef.current = endAt
      cancelRef.current = cbRef.current.onSchedule?.((endAt - Date.now()) / 1000) ?? null
      cbRef.current.onDetect?.(hit)
    }

    const timer = setInterval(scan, BOOSTER.scanIntervalMs)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [stream, enabled, videoRef, buildTemplates])
}
