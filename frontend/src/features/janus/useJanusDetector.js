import { useState, useRef, useCallback, useEffect } from 'react'
import { DETECT, meanLuma, estimateCooldown, cooldownSpread, isOutlier } from './logic'

/**
 * 화면 공유 → 지정 영역 밝기 샘플링 → 사이클 상태머신.
 *
 * UI 갱신은 초당 10번짜리 tick 하나로만 하고, 실제 감지 루프는 전부 ref에서 돈다.
 * (감지는 33ms마다 도는데 그때마다 리렌더하면 화면이 버벅인다)
 */

const MAX_LOGS = 40
const MAX_SAMPLES = 8

export function useJanusDetector({ onCycleStart, onCycleEnd }) {
  const [stream, setStream] = useState(null)
  const [region, setRegion] = useState(null)      // {x,y,w,h} — 0~1 정규화
  const [status, setStatus] = useState('idle')    // idle | cooling
  const [cycle, setCycle] = useState(null)        // {index, installedAt}
  const [samples, setSamples] = useState([])      // 실측 쿨타임(ms)
  const [logs, setLogs] = useState([])
  const [stale, setStale] = useState(false)
  const [level, setLevel] = useState(null)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const regionRef = useRef(null)
  const baselineRef = useRef(null)   // "밝음" 기준 휘도
  const stateRef = useRef('bright')  // bright | dark (감지기 내부 상태)
  const pendingRef = useRef(null)    // 확정 대기 중인 전환 {state, since}
  const levelRef = useRef(null)      // 최근 밝기 {luma, base} — 진단 표시용
  const estimateRef = useRef(null)   // 감지 루프 안에서 현재 추정치를 보기 위한 사본
  const cycleRef = useRef(null)
  const lastFrameRef = useRef(0)

  // 콜백을 ref로 잡아둔다 — 감지 루프를 매번 다시 만들지 않기 위해
  const cbRef = useRef({ onCycleStart, onCycleEnd })
  useEffect(() => { cbRef.current = { onCycleStart, onCycleEnd } })

  const log = useCallback((message, tag, tagColor) => {
    setLogs((prev) => [{ at: Date.now(), message, tag, tagColor }, ...prev].slice(0, MAX_LOGS))
  }, [])

  /* ── 화면 공유 시작/중지 ────────────────────────────────── */

  const start = useCallback(async () => {
    setError(null)
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        // 창 목록이 먼저 뜨게 하는 힌트. 어떤 창을 고를지는 브라우저 UI에서 사용자가 정한다
        video: { displaySurface: 'window', frameRate: { ideal: 30 } },
        audio: false,
      })
      media.getVideoTracks()[0]?.addEventListener('ended', () => {
        setStream(null)
        setStatus('idle')
      })
      setStream(media)
      log('화면 공유 시작', '연결됨', 'ok')
      return true
    } catch (e) {
      // 사용자가 선택창을 닫은 건 오류가 아니다
      if (e?.name !== 'NotAllowedError') setError(e?.message || '화면 공유를 시작하지 못했습니다')
      return false
    }
  }, [log])

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    setStatus('idle')
    stateRef.current = 'bright'
    baselineRef.current = null
    pendingRef.current = null
    cycleRef.current = null
    setCycle(null)
  }, [stream])

  /* ── 사이클 ─────────────────────────────────────────────── */

  const resetCycle = useCallback(() => {
    cycleRef.current = null
    setCycle(null)
    setStatus('idle')
    stateRef.current = 'bright'
    pendingRef.current = null
    cbRef.current.onCycleEnd?.({ cancelled: true })
    log('수동 리셋', '사용자', 'muted')
  }, [log])

  /* ── 감지 루프 ──────────────────────────────────────────── */

  useEffect(() => { regionRef.current = region }, [region])

  useEffect(() => {
    if (!stream || !region) return

    const video = videoRef.current
    if (!video) return

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    const canvas = canvasRef.current
    // 영역 전체를 24×24로 줄여서 평균만 본다 — 픽셀 수가 적어야 33ms마다 돌려도 가볍다
    canvas.width = 24
    canvas.height = 24
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    let alive = true

    // 프레임이 실제로 갱신되는지 별도로 센다 (게임 창이 최소화되면 멈춘다)
    let rvfcHandle = null
    const countFrame = () => {
      lastFrameRef.current = performance.now()
      if (alive && video.requestVideoFrameCallback) {
        rvfcHandle = video.requestVideoFrameCallback(countFrame)
      }
    }
    if (video.requestVideoFrameCallback) {
      lastFrameRef.current = performance.now()
      rvfcHandle = video.requestVideoFrameCallback(countFrame)
    }

    const sample = () => {
      if (!alive) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      const r = regionRef.current
      const sx = Math.max(0, Math.round(r.x * vw))
      const sy = Math.max(0, Math.round(r.y * vh))
      const sw = Math.max(1, Math.round(r.w * vw))
      const sh = Math.max(1, Math.round(r.h * vh))

      try {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 24, 24)
      } catch {
        return // 프레임이 아직 준비 안 됨
      }
      const luma = meanLuma(ctx.getImageData(0, 0, 24, 24).data)
      const now = Date.now()

      // 기준선(밝을 때의 휘도)을 서서히 따라간다 — 맵이 밝아지거나 어두워져도 따라감
      if (baselineRef.current == null) {
        baselineRef.current = luma
        return
      }
      const base = baselineRef.current
      const isDark = luma < base * DETECT.darkRatio
      const isBright = luma > base * DETECT.brightRatio
      levelRef.current = { luma, base }

      const want = isDark ? 'dark' : isBright ? 'bright' : stateRef.current
      if (want === stateRef.current) {
        pendingRef.current = null
        // 밝은 상태에서만, 그것도 기준 근처 값으로만 기준선을 갱신한다.
        // (어두울 때 갱신하면 기준선이 같이 내려가고, 번쩍임까지 섞으면 기준선이 올라간다)
        if (
          stateRef.current === 'bright' &&
          luma > base * DETECT.baselineAcceptLow &&
          luma < base * DETECT.baselineAcceptHigh
        ) {
          baselineRef.current = base * 0.98 + luma * 0.02
        }
        return
      }

      // 임계선을 넘었다고 바로 확정하지 않는다 — 그 상태가 confirmMs 동안 유지돼야 한다
      if (pendingRef.current?.state !== want) {
        pendingRef.current = { state: want, since: now }
        return
      }
      const need = want === 'dark' ? DETECT.confirmDarkMs : DETECT.confirmBrightMs
      if (now - pendingRef.current.since < need) return

      // 확정. 다만 시각은 처음 넘어간 순간으로 소급한다 (확정 지연이 타이머에 반영되지 않도록)
      const at = pendingRef.current.since
      pendingRef.current = null
      stateRef.current = want

      if (want === 'dark') {
        const started = { index: (cycleRef.current?.index || 0) + 1, installedAt: at }
        cycleRef.current = started
        setCycle(started)
        setStatus('cooling')
        log(`설치 감지 — 사이클 #${started.index} 시작`, '아이콘 어두워짐', 'ok')
        cbRef.current.onCycleStart?.(started)
      } else {
        const c = cycleRef.current
        setStatus('idle')
        if (!c) return
        const darkMs = at - c.installedAt
        if (darkMs < DETECT.minCooldownMs) {
          // 스킬 이펙트나 화면 연출로 잠깐 어두워진 것 — 사이클로 치지 않는다
          cycleRef.current = null
          setCycle(null)
          log(`짧은 어두움(${(darkMs / 1000).toFixed(1)}초) — 설치가 아니라고 보고 취소`, '무시', 'warn')
          cbRef.current.onCycleEnd?.({ cancelled: true })
          return
        }
        if (isOutlier(darkMs, estimateRef.current)) {
          log(`쿨타임 종료 — ${(darkMs / 1000).toFixed(1)}초는 기존과 너무 달라 표본에서 제외`, '이상값', 'warn')
        } else {
          setSamples((prev) => [...prev, darkMs].slice(-MAX_SAMPLES))
          log(`쿨타임 종료 — 이번 사이클 ${(darkMs / 1000).toFixed(1)}초로 측정`, '아이콘 밝아짐', 'ok')
        }
        cbRef.current.onCycleEnd?.({ measuredMs: darkMs, cycle: c })
      }
    }

    const sampler = setInterval(sample, DETECT.intervalMs)

    // 프레임이 끊기면 경고 (게임 창이 가려졌거나 최소화됨)
    const watchdog = setInterval(() => {
      if (!video.requestVideoFrameCallback) return
      setStale(performance.now() - lastFrameRef.current > DETECT.staleWarnMs)
    }, 1000)

    // 타이머 표시용 — 감지와 분리해서 초당 10번만 리렌더
    const ui = setInterval(() => {
      setTick((t) => t + 1)
      setLevel(levelRef.current)
    }, 100)

    return () => {
      alive = false
      clearInterval(sampler)
      clearInterval(watchdog)
      clearInterval(ui)
      if (rvfcHandle && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(rvfcHandle)
      }
    }
  }, [stream, region, log])

  const estimate = estimateCooldown(samples)
  // 감지 루프(ref 안)에서도 현재 추정치를 봐야 이상값을 걸러낼 수 있다
  useEffect(() => { estimateRef.current = estimate }, [estimate])

  return {
    stream, region, setRegion,
    status, cycle, samples, logs, error, level,
    // 공유가 끊기면 경고도 같이 내린다
    stale: stream ? stale : false,
    estimateMs: estimate,
    spreadSec: cooldownSpread(samples, estimate),
    videoRef,
    start, stop, resetCycle, log,
  }
}
