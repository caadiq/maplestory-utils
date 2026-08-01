import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DETECT, LOCATE, meanLuma, toShapeVector, shapeSimilarity,
  findMatches, saveTemplate, loadTemplate,
} from './logic'

/**
 * 화면 공유 → 지정 영역 밝기 샘플링 → **설치 감지만** 한다.
 *
 * 쿨타임 종료(어두움 → 밝음)는 재지 않는다. 아이콘이 쿨타임 막바지 약 5초 동안
 * 깜빡여서 그 밝은 순간이 종료로 잡히고, 매 사이클이 그만큼 짧게 측정됐다.
 * 어차피 지속시간은 스킬 레벨로 정해져 있으니 설치 순간만 잡으면 나머지는 타이머로 충분하다.
 *
 * 밝아짐은 "다음 설치를 감지할 수 있는 상태로 돌아왔다"는 의미로만 쓴다.
 * 사냥 사이클상 재설치는 쿨이 돈 직후가 아니라 지속시간이 끝나갈 때 하므로,
 * 밝아짐 확정을 넉넉히 잡아 깜빡임을 걸러도 설치를 놓치지 않는다.
 *
 * UI 갱신은 초당 10번짜리 tick 하나로만 하고, 감지 루프는 전부 ref에서 돈다.
 */

const MAX_LOGS = 40

/** icon/ 폴더에 원본을 넣어두면 한 번도 지정하지 않은 상태에서도 자동으로 찾는다 */
const iconFiles = import.meta.glob('./icon/*.{png,webp,jpg}', {
  eager: true, query: '?url', import: 'default',
})
const BUILTIN_ICON_URL = Object.values(iconFiles)[0] ?? null
export const HAS_BUILTIN_ICON = Boolean(BUILTIN_ICON_URL)

export function useJanusDetector({ onInstall }) {
  const [stream, setStream] = useState(null)
  const [region, setRegion] = useState(null)   // {x,y,w,h} — 0~1 정규화
  const [install, setInstall] = useState(null) // {index, at}
  const [iconDark, setIconDark] = useState(false)
  const [logs, setLogs] = useState([])
  const [stale, setStale] = useState(false)
  const [match, setMatch] = useState(null)     // 아이콘 일치도 (진단용)
  const [iconLost, setIconLost] = useState(false)
  const [level, setLevel] = useState(null)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const regionRef = useRef(null)
  const baselineRef = useRef(null)   // "밝음" 기준 휘도
  const ctxBaseRef = useRef(null)    // 주변 영역의 기준 휘도
  const stateRef = useRef('bright')  // 확정된 상태: bright | dark
  const rawRef = useRef('bright')    // 임계선만 적용한 즉시 상태
  const rawSinceRef = useRef(0)      // 그 즉시 상태가 시작된 시각
  const dipSinceRef = useRef(null)   // "확실히 밝음"에서 처음 벗어난 시각 (진짜 설치 순간에 가깝다)
  const latencyRef = useRef(0)       // 화면 공유 파이프라인 지연(ms)
  const templateRef = useRef(null)   // 지정할 때 기억한 아이콘 모양
  const builtinIconRef = useRef(null) // icon/ 폴더의 원본 (있을 때만)
  const matchRef = useRef(null)
  const lostSinceRef = useRef(null)
  const levelRef = useRef(null)
  const indexRef = useRef(0)
  const lastFrameRef = useRef(0)

  const cbRef = useRef({ onInstall })
  useEffect(() => { cbRef.current = { onInstall } })

  // 페이지를 떠나면 화면 공유도 끊는다.
  // 안 그러면 뒤로 가도 브라우저의 "공유 중" 표시가 남고 캡처가 계속 돈다.
  const streamRef = useRef(null)
  useEffect(() => { streamRef.current = stream }, [stream])
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  // 내장 아이콘 원본을 한 번만 읽어둔다
  useEffect(() => {
    if (!BUILTIN_ICON_URL || builtinIconRef.current) return
    const img = new Image()
    img.src = BUILTIN_ICON_URL
    builtinIconRef.current = img
  }, [])

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
      media.getVideoTracks()[0]?.addEventListener('ended', () => setStream(null))
      setStream(media)
      log('화면 공유 시작', '연결됨', 'ok')
      return true
    } catch (e) {
      // 사용자가 선택창을 닫은 건 오류가 아니다
      if (e?.name !== 'NotAllowedError') setError(e?.message || '화면 공유를 시작하지 못했습니다')
      return false
    }
  }, [log])

  const resetDetector = () => {
    stateRef.current = 'bright'
    rawRef.current = 'bright'
    dipSinceRef.current = null
    baselineRef.current = null
    ctxBaseRef.current = null
    setIconDark(false)
  }

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    resetDetector()
    setInstall(null)
  }, [stream])

  /** 오검출이 났을 때 되돌리기 */
  const resetCycle = useCallback(() => {
    setInstall(null)
    resetDetector()
    log('수동 리셋', '사용자', 'muted')
  }, [log])

  /** 아이콘을 놓쳤거나 화면 공유 전에 이미 깔아둔 경우 — 지금을 설치 시각으로 */
  const markInstalledNow = useCallback(() => {
    indexRef.current += 1
    const next = { index: indexRef.current, at: Date.now() }
    setInstall(next)
    log(`설치 시각을 지금으로 지정 — 사이클 #${next.index}`, '수동', 'muted')
    cbRef.current.onInstall?.(next)
  }, [log])

  /* ── 감지 루프 ──────────────────────────────────────────── */

  useEffect(() => {
    regionRef.current = region
    // 영역을 다시 지정하면 기준 모양도 새로 잡는다
    templateRef.current = null
    baselineRef.current = null
    ctxBaseRef.current = null
    lostSinceRef.current = null
  }, [region])

  /**
   * 화면 전체에서 아이콘 자리를 찾는다.
   * 브라우저가 화면 공유 권한을 기억하지 않아 매번 창을 다시 고르는데,
   * 그때마다 아이콘까지 다시 집는 건 번거로워서 자동으로 찾아준다.
   *
   * 직접 지정한 적이 있으면 그 모양을(사용자 화면의 실물이라 가장 정확),
   * 없으면 icon/ 폴더의 원본을 여러 크기로 훑는다.
   *
   * 줄인 화면에서 자리만 추린 뒤 원본 해상도에서 다시 확인하는 2단계다.
   * 줄인 화면에서는 아이콘이 15px 남짓이라 세부가 뭉개져 그것만으로는 판정을 못 믿는다.
   */
  const locate = useCallback(() => {
    const video = videoRef.current
    if (!video?.videoWidth) return null

    const vw = video.videoWidth
    const vh = video.videoHeight

    /** 화면을 주어진 폭으로 줄여 밝기 배열로 만든다 */
    const grabFrame = (w) => {
      const h = Math.round(vh * (w / vw))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const c = canvas.getContext('2d', { willReadFrequently: true })
      try {
        c.drawImage(video, 0, 0, w, h)
      } catch {
        return null
      }
      const px = c.getImageData(0, 0, w, h).data
      // 밝기가 아니라 자주색 성분으로 찾는다 (아이콘 위 단축키 글자에 덜 흔들린다)
      const gray = new Float32Array(w * h)
      for (let i = 0; i < gray.length; i++) {
        const p = i * 4
        gray[i] = (px[p] + px[p + 2]) / 2 - px[p + 1]
      }
      return { gray, w, h }
    }

    /** source를 tw×th로 줄여 모양 벡터를 만든다 */
    const templateAt = (source, sw, sh, tw, th) => {
      const t = document.createElement('canvas')
      t.width = tw
      t.height = th
      const tctx = t.getContext('2d', { willReadFrequently: true })
      tctx.drawImage(source, 0, 0, sw, sh, 0, 0, tw, th)
      return toShapeVector(tctx.getImageData(0, 0, tw, th).data, 'chroma')
    }

    const coarse = grabFrame(LOCATE.frameWidth)
    const full = grabFrame(vw)
    if (!coarse || !full) return null
    const ratio = LOCATE.frameWidth / vw

    const saved = loadTemplate()
    let source = null
    let sizes = []
    if (saved) {
      const tc = document.createElement('canvas')
      tc.width = saved.tw
      tc.height = saved.th
      tc.getContext('2d').putImageData(
        new ImageData(new Uint8ClampedArray(saved.rgba), saved.tw, saved.th), 0, 0,
      )
      source = { el: tc, w: saved.tw, h: saved.th }
      sizes = [{ w: Math.round(saved.rw * vw), h: Math.round(saved.rh * vh) }]
    } else {
      const img = builtinIconRef.current
      if (!img?.complete || !img.naturalWidth) return null
      source = { el: img, w: img.naturalWidth, h: img.naturalHeight }
      sizes = LOCATE.builtinSizes.map((n) => ({ w: n, h: Math.round(n * (img.naturalHeight / img.naturalWidth)) }))
    }

    // 1단계 — 대표 크기 몇 개로 줄인 화면을 훑어 자리만 추린다
    const aspect = source.h / source.w
    const probes = saved
      ? [sizes[0]]
      : LOCATE.coarseSizes.map((n) => ({ w: n, h: Math.round(n * aspect) }))
    const spots = []
    for (const probe of probes) {
      const ctw = Math.max(6, Math.round(probe.w * ratio))
      const cth = Math.max(6, Math.round(probe.h * ratio))
      const coarseTpl = templateAt(source.el, source.w, source.h, ctw, cth)
      if (!coarseTpl) continue
      for (const hit of findMatches(coarse.gray, coarse.w, coarse.h, coarseTpl, ctw, cth, {
        step: 3, minScore: LOCATE.coarseScore,
      }).slice(0, LOCATE.coarseKeep)) {
        if (spots.some((sp) => Math.abs(sp.x - hit.x) < LOCATE.mergeDistance && Math.abs(sp.y - hit.y) < LOCATE.mergeDistance)) continue
        spots.push(hit)
      }
    }

    // 2단계 — 후보 주변을 원본 해상도에서, 여러 크기로 촘촘히 다시 본다
    const results = []
    for (const spot of spots) {
      const cx = Math.round(spot.x / ratio)
      const cy = Math.round(spot.y / ratio)
      const r = LOCATE.refineRadius
      for (const size of sizes) {
        const fullTpl = templateAt(source.el, source.w, source.h, size.w, size.h)
        if (!fullTpl) continue
        const best = findMatches(full.gray, full.w, full.h, fullTpl, size.w, size.h, {
          step: 1,
          // 통과선에 못 미쳐도 일단 모아둔다 — 자동으로 못 고르더라도
          // "이 중에 고르세요"가 직접 드래그보다 낫다
          minScore: LOCATE.looseScore,
          bounds: { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r },
          merge: false,
        })[0]
        if (best) results.push({ score: best.score, x: best.x, y: best.y, size })
      }
    }

    // 같은 자리를 여러 크기로 잡았을 수 있으니 한 번 더 합친다
    results.sort((a, b) => b.score - a.score)
    const merged = []
    for (const c of results) {
      if (merged.some((m) => Math.abs(m.x - c.x) < c.size.w * 0.7 && Math.abs(m.y - c.y) < c.size.h * 0.7)) continue
      merged.push(c)
      if (merged.length >= LOCATE.maxCandidates) break
    }

    return merged.map((c) => ({
      score: c.score,
      region: { x: c.x / vw, y: c.y / vh, w: c.size.w / vw, h: c.size.h / vh },
    }))
  }, [])

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

    // 주변 밝기를 재는 별도 캔버스 (아이콘만 어두워진 건지 화면이 어두워진 건지 가른다)
    const ctxCanvas = document.createElement('canvas')
    ctxCanvas.width = 16
    ctxCanvas.height = 16
    const ctxCtx = ctxCanvas.getContext('2d', { willReadFrequently: true })

    let alive = true

    // 프레임이 실제로 갱신되는지 별도로 센다 (게임 창이 최소화되면 멈춘다)
    let rvfcHandle = null
    const countFrame = (now, metadata) => {
      lastFrameRef.current = performance.now()
      // 화면이 캡처된 시각과 지금 사이의 간격 = 공유 파이프라인 지연.
      // 이만큼 과거의 화면을 보고 있는 셈이라 감지 시각에서 빼줘야 실제와 맞는다.
      if (metadata?.captureTime != null) {
        const lag = Math.min(1000, Math.max(0, performance.now() - metadata.captureTime))
        latencyRef.current = latencyRef.current * 0.8 + lag * 0.2
      }
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
      const pixels = ctx.getImageData(0, 0, 24, 24).data
      const now = Date.now()

      // 지정 직후 첫 프레임을 기준 모양으로 기억하고, 다음 접속을 위해 저장해둔다
      if (!templateRef.current) {
        templateRef.current = toShapeVector(pixels)
        const r = regionRef.current
        saveTemplate({ rgba: Array.from(pixels), tw: 24, th: 24, rw: r.w, rh: r.h })
        return
      }

      // 밝기를 보기 전에 "이게 야누스 아이콘이 맞는지"부터 확인한다.
      // 다른 창에 가려지거나 퀵슬롯이 잠깐 사라지면 모양이 통째로 달라지는데,
      // 밝기만 보면 그걸 "어두워졌다"로 읽어 설치로 오인한다.
      const shape = toShapeVector(pixels)
      const similarity = shapeSimilarity(shape, templateRef.current)
      matchRef.current = similarity

      if (similarity < DETECT.matchThreshold) {
        // 못 알아보는 동안에는 상태를 건드리지 않고 그대로 얼려둔다
        if (lostSinceRef.current == null) lostSinceRef.current = now
        return
      }
      lostSinceRef.current = null

      // 아이콘 주변까지 넓게 한 번 더 본다
      const cw = sw * DETECT.contextScale
      const ch = sh * DETECT.contextScale
      const cx = Math.max(0, Math.min(vw - cw, sx + sw / 2 - cw / 2))
      const cy = Math.max(0, Math.min(vh - ch, sy + sh / 2 - ch / 2))
      try {
        ctxCtx.drawImage(video, cx, cy, cw, ch, 0, 0, 16, 16)
      } catch {
        return
      }
      const ctxLuma = meanLuma(ctxCtx.getImageData(0, 0, 16, 16).data)
      if (ctxBaseRef.current == null) ctxBaseRef.current = ctxLuma
      const ctxRatio = ctxBaseRef.current > 1 ? ctxLuma / ctxBaseRef.current : 1

      // 주변까지 함께 어두워졌다 — 맵 이동 같은 화면 전체 변화이므로 판단을 쉰다
      if (ctxRatio < DETECT.contextBlackout) {
        if (lostSinceRef.current == null) lostSinceRef.current = now
        return
      }
      // 주변 밝기가 평소 범위일 때만 기준을 따라간다
      if (ctxRatio > 0.8 && ctxRatio < 1.25) {
        ctxBaseRef.current = ctxBaseRef.current * 0.98 + ctxLuma * 0.02
      }

      const luma = meanLuma(pixels)

      if (baselineRef.current == null) {
        baselineRef.current = luma
        rawSinceRef.current = now
        return
      }
      // 주변이 어두워진 만큼은 빼고 본다 — 그래야 "아이콘만" 어두워진 것을 잡는다
      const base = baselineRef.current * ctxRatio
      levelRef.current = { luma, base }

      // 히스테리시스 — 경계에서 떨리는 것 방지
      const raw = luma < base * DETECT.darkRatio ? 'dark'
        : luma > base * DETECT.brightRatio ? 'bright'
          : rawRef.current
      if (raw !== rawRef.current) {
        rawRef.current = raw
        rawSinceRef.current = now
      }

      // 어두워지는 건 한 번에 뚝 떨어지지 않는다. 쿨타임 숫자가 겹쳐 있어서
      // 잠깐 히스테리시스 구간(0.78~0.88)에 머무르다 내려가는데, 그 구간에 들어선 순간이
      // 실제로 스킬을 쓴 시점에 가깝다. 판정선을 넘은 순간만 보면 그만큼 늦게 잡힌다.
      if (stateRef.current === 'bright') {
        if (luma < base * DETECT.brightRatio) {
          if (dipSinceRef.current == null) dipSinceRef.current = now
        } else {
          dipSinceRef.current = null
        }
      }

      if (raw === stateRef.current) {
        // 밝은 상태에서만, 그것도 기준 근처 값으로만 기준선을 갱신한다.
        // (어두울 때 갱신하면 기준선이 같이 내려가고, 번쩍임까지 섞으면 기준선이 올라간다)
        // "확실히 밝은" 값으로만 갱신한다.
        // 살짝 떨어진 값까지 섞으면 기준선이 그쪽으로 끌려 내려가고,
        // 그러면 어두워지기 시작한 흔적(dipSince)이 지워져 설치 시각이 늦게 잡힌다.
        if (
          stateRef.current === 'bright' &&
          luma > base * DETECT.brightRatio &&
          luma < base * DETECT.baselineAcceptHigh
        ) {
          // 주변 보정을 되돌린 값으로 저장해야 기준이 흔들리지 않는다
          const raw0 = luma / (ctxRatio || 1)
          baselineRef.current = baselineRef.current * 0.98 + raw0 * 0.02
        }
        return
      }

      // 임계선을 넘었다고 바로 확정하지 않는다 — 그 상태가 일정 시간 유지돼야 한다
      const need = raw === 'dark' ? DETECT.confirmDarkMs : DETECT.confirmBrightMs
      if (now - rawSinceRef.current < need) return

      stateRef.current = raw
      setIconDark(raw === 'dark')

      if (raw === 'dark') {
        // 확정은 늦어도 시각은 처음 어두워지기 시작한 순간으로 소급하고,
        // 화면 공유 지연만큼 더 당긴다
        const onset = Math.min(rawSinceRef.current, dipSinceRef.current ?? rawSinceRef.current)
        dipSinceRef.current = null
        indexRef.current += 1
        const next = { index: indexRef.current, at: onset - Math.round(latencyRef.current) }
        setInstall(next)
        log(`설치 감지 — 사이클 #${next.index} 시작`, '아이콘 어두워짐', 'ok')
        cbRef.current.onInstall?.(next)
      }
      // 밝아짐은 "다음 설치를 볼 준비가 됐다"는 뜻일 뿐, 따로 알리지 않는다
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
      setMatch(matchRef.current)
      setIconLost(lostSinceRef.current != null && Date.now() - lostSinceRef.current > DETECT.lostWarnMs)
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

  return {
    stream, region, setRegion,
    install, iconDark, logs, error, level, match, iconLost,
    // 공유가 끊기면 경고도 같이 내린다
    stale: stream ? stale : false,
    videoRef,
    start, stop, resetCycle, markInstalledNow, locate, log,
    hasTemplate: Boolean(loadTemplate()) || HAS_BUILTIN_ICON,
  }
}
