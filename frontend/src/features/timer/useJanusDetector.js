import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DETECT, toShapeVector, shapeSimilarity,
  saveTemplate, loadTemplate,
} from './logic'
import { LOCATE, candidateSizes, probeSizes, normalize, toChroma, locateIcon } from './locateCore'
import { inspectCooldown, createCooldownTracker } from './digits'

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

/** 탐색을 워커에서 돌린다. 워커를 못 쓰면 같은 계산을 이 자리에서 한다 */
let locateWorker = null
let locateSeq = 0
function runLocate(payload) {
  if (typeof Worker === 'undefined') return Promise.resolve(locateIcon(payload))
  try {
    if (!locateWorker) {
      locateWorker = new Worker(new URL('./locate.worker.js', import.meta.url), { type: 'module' })
    }
  } catch {
    return Promise.resolve(locateIcon(payload))
  }
  const id = ++locateSeq
  return new Promise((resolve) => {
    const onMessage = (e) => {
      if (e.data?.id !== id) return
      locateWorker.removeEventListener('message', onMessage)
      resolve(e.data.hits || [])
    }
    locateWorker.addEventListener('message', onMessage)
    locateWorker.postMessage({ id, payload })
  })
}

/**
 * icon/ 폴더에 원본을 넣어두면 한 번도 지정하지 않은 상태에서도 자동으로 찾는다.
 * 새벽/황혼은 아이콘 모양이 서로 완전히 달라서 모드별로 파일을 따로 둔다
 * (janus-dawn.png / janus-dusk.png). 이름이 안 맞으면 첫 파일로 떨어진다.
 */
const iconFiles = import.meta.glob('./icon/*.{png,webp,jpg}', {
  eager: true, query: '?url', import: 'default',
})
const iconByMode = (mode) => {
  const hit = Object.entries(iconFiles).find(([p]) => p.includes(`janus-${mode}`))
  return hit?.[1] ?? Object.values(iconFiles)[0] ?? null
}
export const HAS_BUILTIN_ICON = Object.keys(iconFiles).length > 0

/** 쿨타임 중 모습을 이만큼 모아 평균 내면 숫자가 흐려지고 아이콘만 남는다 */
const DARK_SAMPLES = 8

/** 이보다 짧은 "숫자 안 보임"은 이펙트가 스친 것으로 보고 같은 구간으로 잇는다 */
const ABSENT_MS = 800
/** 새 설치의 쿨타임 값은 이보다 크다 (야누스 쿨 54~60초) — 작은 값의 오독을 후보에서 배제 */
const CAND_MIN_VALUE = 20
/** 후보 값과 이어지는 두 번째 읽기가 이만큼 지난 뒤에 와야 확정한다 */
const CONFIRM_SPAN_MS = 250
/** 설치 후 이 시간 동안은 새 설치가 물리적으로 불가능하다 (쿨타임보다 짧게 여유) */
const NEW_CYCLE_LOCK_MS = 45000
/** 카운트다운 일치 판정 허용 오차 (초) */
const VALUE_TOL = 1.5
/**
 * 황혼 — 쿨타임 숫자를 마지막으로 본 지 이 시간 안이면 "사냥 중"으로 본다.
 * 쿨이 3초 주기라 넉넉히 잡아도 사냥을 멈춘 상태와 확실히 구분된다.
 */
const DUSK_ACTIVE_MS = 6000
/** 황혼 쿨타임은 3초라 값이 1~3뿐이다. 이보다 크면 황혼이 아니다 */
const DUSK_MAX_VALUE = 5
/**
 * '이 아이콘이 정말 황혼인가'의 유효기간.
 *
 * digitCount는 숫자로 읽히지 않은 금색 덩어리도 세므로 그것만 믿으면
 * 쿨타임이 아예 없는 아이콘에서도 사이클이 시작된다 — 황혼으로 공유 중
 * 새벽 캐릭터로 바꾸면 상시 참이 돼 초기화해도 즉시 재시작됐다.
 *
 * 값을 읽는 것만으로도 부족하다. 새벽 아이콘 우하단에는 금색 스택 배지가
 * 늘 붙어 있어(실측 4x5px) 작은 값으로 읽힐 수 있다.
 * 결정적 차이는 **쿨타임은 줄어들고 배지는 고정**이라는 점이라,
 * 값이 실제로 바뀌는 걸 봐야 황혼으로 인정한다.
 */
const DUSK_CONFIRM_TTL_MS = 30000

export function useJanusDetector({ onInstall, onModeMismatch, mode = 'dawn', cycleMs = 0 }) {
  const [stream, setStream] = useState(null)
  const [region, setRegion] = useState(null)   // {x,y,w,h} — 0~1 정규화
  const [install, setInstall] = useState(null) // {index, at}
  const [logs, setLogs] = useState([])
  const [stale, setStale] = useState(false)
  const [sync, setSync] = useState(null)      // 쿨타임 숫자로 설치 시각 보정 — 'pending' | 'done' | null
  const [iconLost, setIconLost] = useState(false)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const regionRef = useRef(null)
  /*
   * 설치는 밝기가 아니라 **쿨타임 숫자의 등장**으로 판별한다.
   * 밝기는 이펙트·깜빡임·가림에 흔들리지만 숫자에는 값이 있어 검증이 된다 —
   * 쿨타임 값은 사이클 내내 줄어들기만 하므로, **위로 점프한 값만이 새 설치**다.
   * 이펙트로 숫자가 잠깐 안 읽히다 다시 읽혀도 값이 이어지면 설치가 아니라고 확정할 수 있다.
   */
  const lastReadRef = useRef(null)      // 마지막으로 믿고 받아들인 값 { v, t }
  const candRef = useRef(null)          // 새 설치 후보 { v, t, startAt }
  const presentRef = useRef(false)      // 직전 프레임에 숫자가 보였는지
  const presenceStartRef = useRef(0)    // 이번 "숫자 보임" 구간이 시작된 시각
  const absentSinceRef = useRef(null)   // 숫자가 안 보이기 시작한 시각
  const lockUntilRef = useRef(0)        // 설치 직후 쿨타임이 도는 동안은 새 설치가 물리적으로 불가능
  const freshRunRef = useRef(false)     // 이번 "숫자 보임" 구간이 진짜 부재 뒤에 시작됐는지
  const latencyRef = useRef(0)       // 화면 공유 파이프라인 지연(ms)
  const templateRef = useRef(null)   // 지정할 때 기억한 아이콘 모양
  const darkAccRef = useRef({ sum: new Float64Array(24 * 24 * 4), n: 0, at: 0 }) // 쿨타임 중 모습 평균
  const builtinIconsRef = useRef({}) // icon/ 폴더의 원본 (모드별)
  const modeRef = useRef(mode)
  const cycleMsRef = useRef(cycleMs)
  const lostSinceRef = useRef(null)
  const indexRef = useRef(0)
  const lastFrameRef = useRef(0)
  const lastDigitAtRef = useRef(0)   // 쿨타임 숫자를 마지막으로 본 시각 (황혼 사이클 재시작 판단용)
  const bigReadingRef = useRef(null) // 황혼 모드에서 읽힌 '큰 쿨타임' — 모드 불일치 판단용
  const duskSeenAtRef = useRef(0)    // 황혼 쿨타임이 '줄어드는 것'을 마지막으로 확인한 시각
  const duskLastValRef = useRef(null) // 직전에 읽은 작은 값 — 변화를 보기 위한 비교용

  const cbRef = useRef({ onInstall, onModeMismatch })
  useEffect(() => { cbRef.current = { onInstall, onModeMismatch } })

  // 마지막 설치 시각 — 한 사이클 안에서 또 설치로 잡히는 것을 막는다
  const lastInstallRef = useRef(0)
  // 쿨타임 숫자로 설치 시각을 역산한다 — 밝기로 잡은 시각의 지연을 스스로 보정한다
  const trackerRef = useRef(createCooldownTracker())
  const installRef = useRef(null)

  // 페이지를 떠나면 화면 공유도 끊는다.
  // 안 그러면 뒤로 가도 브라우저의 "공유 중" 표시가 남고 캡처가 계속 돈다.
  const streamRef = useRef(null)
  useEffect(() => { streamRef.current = stream }, [stream])
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  /*
   * 내장 아이콘 원본 — 새벽/황혼 **둘 다** 미리 읽어둔다.
   * 탐색할 때 두 모양을 모두 대조해 더 잘 맞는 쪽으로 모드를 자동 판별하기 위해서다
   * (실측: 황혼이 끼워진 화면에 새벽 아이콘을 대면 정답이 10위 밖으로 밀린다).
   */
  useEffect(() => {
    for (const m of ['dawn', 'dusk']) {
      const url = iconByMode(m)
      if (!url || builtinIconsRef.current[m]) continue
      const img = new Image()
      img.src = url
      builtinIconsRef.current[m] = img
    }
  }, [])

  useEffect(() => { modeRef.current = mode; cycleMsRef.current = cycleMs }, [mode, cycleMs])

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
    lastReadRef.current = null
    candRef.current = null
    presentRef.current = false
    freshRunRef.current = false
    presenceStartRef.current = 0
    absentSinceRef.current = null
    lockUntilRef.current = 0
    /*
     * 황혼은 "최근에 쿨타임을 봤나"로 사이클을 시작한다. 이 시각을 안 지우면
     * 초기화 직후에도 조건이 그대로 참이라 다음 tick(100ms)에 곧바로 다시 시작해
     * 아무리 눌러도 멈추지 않는다. 리셋은 본 기억까지 지워야 한다.
     */
    lastDigitAtRef.current = 0
    bigReadingRef.current = null
    duskSeenAtRef.current = 0
    duskLastValRef.current = null
  }

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    resetDetector()
    lastInstallRef.current = 0
    installRef.current = null
    trackerRef.current.reset()
    setInstall(null)
  }, [stream])

  /** 오검출이 났을 때 되돌리기 */
  const resetCycle = useCallback(() => {
    lastInstallRef.current = 0
    installRef.current = null
    trackerRef.current.reset()
    setInstall(null)
    resetDetector()
    log('수동 리셋', '사용자', 'muted')
  }, [log])

  /* ── 감지 루프 ──────────────────────────────────────────── */

  /**
   * 화면 전체에서 아이콘 자리를 찾는다.
   * 브라우저가 화면 공유 권한을 기억하지 않아 매번 창을 다시 고르는데,
   * 그때마다 아이콘까지 다시 집는 건 번거로워서 자동으로 찾아준다.
   *
   * 직접 지정한 적이 있으면 그 모양을(사용자 화면의 실물이라 가장 정확),
   * 없으면 icon/ 폴더의 원본을 쓴다. 무거운 계산은 워커에서 돌린다.
   */
  const locate = useCallback(async ({ ignoreSaved = false } = {}) => {
    const video = videoRef.current
    if (!video?.videoWidth) return null

    const vw = video.videoWidth
    const vh = video.videoHeight
    const ratio = LOCATE.frameWidth / vw
    // ignoreSaved: 저장 모양이 엉뚱한 자리에 굳었을 때 내장 원본으로만 다시 찾는다
    const saved = ignoreSaved ? null : loadTemplate()
    // 직접 지정한 적이 있으면 그때의 크기를 먼저 쓴다 — 추측보다 확실한 정보다
    const savedSize = saved ? Math.round(saved.rw * vw) : null
    const sizes = [...new Set([
      ...(savedSize && savedSize >= 10 ? [savedSize] : []),
      ...candidateSizes(vw, vh),
    ])].sort((a, b) => a - b)
    const probes = savedSize ? [...new Set([savedSize, ...probeSizes(sizes)])] : probeSizes(sizes)

    /** 화면을 주어진 폭으로 줄여 RGBA로 꺼낸다 */
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
      return { data: c.getImageData(0, 0, w, h).data, w, h }
    }

    const coarse = grabFrame(LOCATE.frameWidth)
    const full = grabFrame(vw)
    if (!coarse || !full) return null

    /** source를 size×size로 줄여 정규화한 자주색 벡터를 만든다 */
    const vecAt = (source, sw, sh, size) => {
      const t = document.createElement('canvas')
      t.width = size
      t.height = size
      const tctx = t.getContext('2d', { willReadFrequently: true })
      tctx.drawImage(source, 0, 0, sw, sh, 0, 0, size, size)
      return normalize(toChroma(tctx.getImageData(0, 0, size, size).data))
    }

    /*
     * 저장된 모양과 내장 원본을 전부 훑는다. 모양별로 따로 채점하므로 섞여서 흐려질 일이 없고,
     * 저장본이 잘못됐어도(쿨타임 중에 지정해서 어두운 모습이 기준이 된 경우) 원본이 받쳐 준다 —
     * 메이플 타이머류 사이트가 항상 잘 찾는 이유가 바로 "기준이 늘 원본"이기 때문이다.
     */
    const sources = []
    if (saved) {
      const toCanvas = (rgba) => {
        const tc = document.createElement('canvas')
        tc.width = saved.tw
        tc.height = saved.th
        tc.getContext('2d').putImageData(
          new ImageData(new Uint8ClampedArray(rgba), saved.tw, saved.th), 0, 0,
        )
        return { el: tc, w: saved.tw, h: saved.th }
      }
      if (saved.rgba?.length) sources.push(toCanvas(saved.rgba))
      // 쿨타임 중 모습도 저장돼 있으면 같이 훑는다
      if (saved.darkRgba?.length) sources.push(toCanvas(saved.darkRgba))
    }
    // 내장 원본은 새벽·황혼을 모두 넣는다 — 이긴 쪽이 곧 현재 장착 모드다
    for (const m of ['dawn', 'dusk']) {
      const img = builtinIconsRef.current[m]
      if (!img) continue
      if (!img.complete) {
        // 공유 시작 직후에는 아직 로딩 중일 수 있다 — 빠지면 저장 모양만으로 훑게 되니 기다린다
        await img.decode().catch(() => {})
      }
      if (img.complete && img.naturalWidth) {
        sources.push({ el: img, w: img.naturalWidth, h: img.naturalHeight, mode: m })
      }
    }
    if (!sources.length) return null

    // 크기별 템플릿을 미리 만들어 워커로 넘긴다 (워커에는 캔버스가 없다)
    const templates = sources.map((src) => {
      const vecs = {}
      const coarseVecs = {}
      for (const size of sizes) {
        const v = vecAt(src.el, src.w, src.h, size)
        if (v) vecs[size] = v
      }
      for (const size of probes) {
        const v = vecAt(src.el, src.w, src.h, Math.max(6, Math.round(size * ratio)))
        if (v) coarseVecs[size] = v
      }
      return { vecs, coarseVecs, mode: src.mode ?? null }
    })

    /*
     * 모양별로 따로 훑는다.
     *
     * "사용 가능"과 "쿨타임 중"은 서로 다른 상태의 모양이라 점수를 한 줄로 섞으면 안 된다.
     * 쿨타임 중에 공유를 시작하면 쿨타임 모양은 정답 한 곳만 0.65로 집어내는데,
     * 밝은 모양이 엉뚱한 곳에 0.59~0.60을 만들어 "1등과 2등 차이가 작다"며 되물었다.
     * 잘 맞는 쪽을 고르고, 격차는 그 안에서만 따진다.
     */
    const groups = []
    for (const t of templates) {
      const hits = await runLocate({ coarse, full, templates: [t], sizes, probes, ratio })
      if (hits.length) { hits.mode = t.mode; groups.push(hits) }
    }
    if (!groups.length) return { learned: Boolean(saved), hits: [] }
    /*
     * 그룹은 1등 점수가 아니라 "1등이 얼마나 압도적인지"로 고른다.
     * 쿨타임 장면에서 내장 원본은 엉뚱한 곳들에 0.66/0.64를 만들고(격차 0.02),
     * 어두운-평균 모양은 정답 한 곳만 0.65로 찍는다(경쟁자 없음).
     * 점수만 보면 전자가 이겨서 되묻게 되고, 격차로 보면 후자가 이겨서 바로 확정된다.
     */
    const clearness = (hits) => hits[0].score - (hits[1]?.score ?? LOCATE.looseScore)
    /*
     * 사실상 원본과 동일한 일치(0.85+)가 있으면 그 그룹을 믿는다.
     * 격차만 보면 "0.56 단독"인 저장 모양 그룹이 "0.91 + 잡음 0.65"인 원본 그룹을
     * 이기는 일이 실제로 있었다 — 절대 점수가 압도적인 쪽이 답이다.
     */
    const byTop = groups.reduce((a, b) => (b[0].score > a[0].score ? b : a))
    const best = byTop[0].score >= LOCATE.dominantScore
      ? byTop
      : groups.reduce((a, b) => (clearness(b) > clearness(a) ? b : a))

    return {
      // 직접 지정해 저장한 모양인지 — 확신 기준이 달라진다
      learned: Boolean(saved),
      // 내장 원본으로 이긴 경우에만 모드를 알 수 있다 (저장 모양엔 모드 정보가 없다)
      detectedMode: best.mode ?? null,
      hits: best.map((c) => ({
        score: c.score,
        region: { x: c.x / vw, y: c.y / vh, w: c.w / vw, h: c.h / vh },
      })),
    }
  }, [])

  /* ── 감지 루프 ──────────────────────────────────────────── */

  useEffect(() => {
    regionRef.current = region
    // 영역을 다시 지정하면 기준 모양도 새로 잡는다
    templateRef.current = null
    resetDetector()
    lostSinceRef.current = null
  }, [region])


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

    // 쿨타임 숫자를 읽는 캔버스 — 24×24로 줄인 것으로는 글자가 뭉개져 읽을 수 없다
    const digitCanvas = document.createElement('canvas')
    const digitCtx = digitCanvas.getContext('2d', { willReadFrequently: true })

    // 주변 밝기를 재는 별도 캔버스 (아이콘만 어두워진 건지 화면이 어두워진 건지 가른다)

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

    /**
     * 황혼 사이클 시작 — startAt(ms)을 기준으로 잠금을 걸어 다음 바퀴가 밀리지 않게 한다.
     *
     * startAt은 항상 "화면에서 쿨타임을 본 시각"이다. 공유 화면은 캡처 지연만큼
     * 과거라 그만큼 당겨야 실제와 맞는다. (계산으로 만든 시각을 넘기면 안 된다 —
     * 이미 실시간이라 또 빼면 사이클이 지연만큼 앞당겨진다)
     */
    const startDuskCycle = (startAt, tag) => {
      const at = startAt - Math.round(latencyRef.current)
      indexRef.current += 1
      const next = { index: indexRef.current, at, rawAt: at }
      installRef.current = next
      lastInstallRef.current = startAt
      lockUntilRef.current = startAt + (cycleMsRef.current || 0)
      setInstall(next)
      log(`황혼 — 사이클 #${next.index} 시작`, tag, 'ok')
      cbRef.current.onInstall?.(next)
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

      /*
       * 지정 직후 첫 프레임을 기준 모양으로 기억하고, 다음 접속을 위해 저장해둔다.
       *
       * 단, 쿨타임 중에 지정했다면 그 모습을 "기준"으로 삼으면 안 된다 —
       * 어두운 데다 숫자까지 박힌 모양이 기준이 되면, 다음에 밝은 상태로 시작했을 때
       * 자동 탐색이 아예 못 찾는다(실제로 있었던 일). 그 경우 어두운 모습 칸에만 넣는다.
       */
      if (!templateRef.current) {
        templateRef.current = toShapeVector(pixels)
        const r = regionRef.current
        const saved = loadTemplate()
        const firstDigits = (() => {
          try {
            const dw = Math.max(16, Math.min(96, sw))
            const dh = Math.max(16, Math.min(96, sh))
            digitCanvas.width = dw
            digitCanvas.height = dh
            digitCtx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
            return inspectCooldown(digitCtx.getImageData(0, 0, dw, dh).data, dw, dh).digits
          } catch {
            return 0
          }
        })()
        if (firstDigits > 0) {
          saveTemplate({ ...(saved || { tw: 24, th: 24 }), darkRgba: Array.from(pixels), rw: r.w, rh: r.h })
        } else {
          saveTemplate({ ...(saved || {}), rgba: Array.from(pixels), tw: 24, th: 24, rw: r.w, rh: r.h })
        }
        return
      }

      /*
       * 쿨타임 숫자를 읽는다. 두 가지에 쓴다.
       *  - 이게 야누스 아이콘이 맞다는 증거 (아래 모양 확인의 두 번째 통로)
       *  - 설치 시각을 게임 내부 시계에 맞추는 보정 (숫자가 바뀌는 순간이 정확한 1초 경계)
       */
      let reading = null
      let digitCount = 0
      {
        const dw = Math.max(16, Math.min(96, sw))
        const dh = Math.max(16, Math.min(96, sh))
        if (digitCanvas.width !== dw || digitCanvas.height !== dh) {
          digitCanvas.width = dw
          digitCanvas.height = dh
        }
        try {
          digitCtx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
          const info = inspectCooldown(digitCtx.getImageData(0, 0, dw, dh).data, dw, dh)
          reading = info.reading
          digitCount = info.digits
        } catch {
          reading = null
          digitCount = 0
        }
      }

      // 밝기를 보기 전에 "이게 야누스 아이콘이 맞는지"부터 확인한다.
      // 다른 창에 가려지거나 퀵슬롯이 잠깐 사라지면 모양이 통째로 달라지는데,
      // 밝기만 보면 그걸 "어두워졌다"로 읽어 설치로 오인한다.
      //
      // 단, 쿨타임 중에는 아이콘이 어두워진 데다 숫자까지 얹혀 밝을 때와 모양이 통째로 다르다
      // (실측 유사도 0.07~0.49). 모양만 보면 정작 설치 순간을 "못 알아봄"으로 흘려보낸다.
      // 쿨타임 숫자가 읽혔다면 그 자체가 야누스 아이콘이라는 증거다.
      const shape = toShapeVector(pixels)
      const similarity = shapeSimilarity(shape, templateRef.current)

      if (digitCount > 0) lastDigitAtRef.current = now
      /*
       * 진짜 황혼인지 확인 — 작은 값이 '바뀌는' 것을 봐야 한다.
       * 새벽 아이콘의 스택 배지도 작은 값으로 읽히지만 늘 같은 숫자라 여기서 걸러진다.
       */
      if (reading && reading.value <= DUSK_MAX_VALUE) {
        const prevVal = duskLastValRef.current
        if (prevVal != null && prevVal !== reading.value) duskSeenAtRef.current = now
        duskLastValRef.current = reading.value
      }

      /*
       * 모드 불일치 자동 교정.
       *
       * 황혼은 쿨타임이 3초라 숫자가 1~3만 나온다. 그런데 20 이상이 읽힌다면
       * 그 자리에 있는 건 새벽(쿨 54~60초)이다 — 캐릭터를 바꿔 같은 칸의 아이콘이
       * 새벽으로 바뀐 경우가 실제로 있었고, 황혼 로직은 "숫자가 보이면 시작"이라
       * 그 쿨타임을 사이클 시작으로 읽어 멋대로 타이머를 켰다.
       * 한 번은 오독일 수 있으니 서로 다른 시각의 두 번을 보고 확정한다.
       */
      if (modeRef.current === 'dusk' && reading && reading.value >= CAND_MIN_VALUE) {
        const prev = bigReadingRef.current
        if (prev && now - prev > 400) {
          bigReadingRef.current = null
          log(`쿨타임 ${reading.value}초 — 황혼이 아니라 새벽 아이콘입니다`, '모드 교정', 'warn')
          cbRef.current.onModeMismatch?.('dawn')
          return
        }
        if (!prev) bigReadingRef.current = now
      }

      if (similarity < DETECT.matchThreshold && !digitCount) {
        // 못 알아보는 동안에는 상태를 건드리지 않고 그대로 얼려둔다
        if (lostSinceRef.current == null) lostSinceRef.current = now
        return
      }
      lostSinceRef.current = null

      // 숫자가 바뀌는 순간에 맞춰 설치 시각을 되돌린다.
      // 화면 공유 지연이나 아이콘이 어두워지기까지의 시차와 무관하게 스스로 맞는다.
      if (installRef.current && !trackerRef.current.locked) {
        // 지금 보고 있는 화면은 공유 지연만큼 과거다. 설치 시각도 같은 만큼 당겨 뒀으므로
        // 숫자가 바뀐 시각도 똑같이 당겨야 둘의 간격이 실제와 맞는다.
        const seenAt = now - Math.round(latencyRef.current)
        const fixed = trackerRef.current.push(reading, seenAt, installRef.current.rawAt)
        if (fixed != null && Math.abs(fixed - installRef.current.at) > 120) {
          const next = { ...installRef.current, at: fixed }
          installRef.current = next
          setInstall(next)
          cbRef.current.onInstall?.(next)
        }
      }

      const present = digitCount > 0

      /*
       * 숫자 보임/안 보임 구간 추적.
       * 설치 시각은 숫자가 나타난 첫 프레임으로 소급한다 — 시전과 동시에 숫자가 뜬다.
       * 한두 프레임 끊긴 건(이펙트 스침) 같은 구간으로 이어 붙인다.
       */
      if (present) {
        if (!presentRef.current) {
          const absentFor = absentSinceRef.current == null ? null : now - absentSinceRef.current
          freshRunRef.current = absentFor != null && absentFor >= ABSENT_MS
          if (freshRunRef.current) presenceStartRef.current = now
          /*
           * 황혼은 쿨이 3초라 공백이 ABSENT_MS(800ms)를 못 넘는 경우가 섞인다.
           * 그때 presenceStart가 낡은 값으로 남으면 "옛 시각 + 2분"으로 잠금이 걸려
           * 이미 지난 시각이 되고, 사이클이 제때 안 잡힌다. 황혼에선 항상 지금으로 갱신한다.
           */
          else if (modeRef.current === 'dusk') presenceStartRef.current = now

          /*
           * 황혼 — 쿨타임이 3초라 숫자 값으로는 사이클을 못 잡는다.
           * 대신 "쿨타임이 도는 순간"(숫자가 뜬 첫 프레임)을 사이클 시작으로 쓰고,
           * 한 바퀴(아이템 소멸 2분)가 끝날 때까지 잠가서 3초마다 재시작되는 걸 막는다.
           * 잠금이 풀린 뒤 다음 쿨타임에 자동으로 다음 사이클이 시작된다 —
           * 사냥을 멈추면 쿨이 안 돌아 타이머도 저절로 쉰다.
           */
        }
        absentSinceRef.current = null
      } else if (absentSinceRef.current == null) {
        absentSinceRef.current = now
      }
      presentRef.current = present


      /*
       * 쿨타임 중 모습도 모아 저장해둔다 (자동 탐색용).
       * 한 장이면 그때 숫자까지 박히므로 여러 장을 평균 내 숫자를 흐린다.
       */
      if (present) {
        const acc = darkAccRef.current
        if (now - acc.at > 1500) {
          acc.at = now
          for (let i = 0; i < pixels.length; i++) acc.sum[i] += pixels[i]
          acc.n += 1
          if (acc.n >= DARK_SAMPLES && acc.n % DARK_SAMPLES === 0 && acc.n <= DARK_SAMPLES * 5) {
            const saved = loadTemplate()
            if (saved) {
              saveTemplate({ ...saved, darkRgba: Array.from(acc.sum, (v) => Math.round(v / acc.n)) })
            }
          }
        }
      }

      // 황혼은 위 presence 시점으로 이미 사이클을 잡았다 — 숫자 값 판별은 새벽 전용
      if (modeRef.current === 'dusk') return

      if (!reading) return

      /*
       * 설치 판별 — 밝기가 아니라 **읽어낸 쿨타임 값**으로 한다.
       *
       * 쿨타임 값은 사이클 내내 1초에 하나씩 줄어들기만 한다. 그러므로
       *  - 직전 값에서 이어지는 값: 그냥 진행 중 (이펙트로 잠깐 안 읽혔어도 마찬가지)
       *  - **직전 흐름보다 위로 점프한 값(예: 사라졌다가 54로 등장): 새 설치**
       * 밝기 기반일 때 있었던 오검출(이펙트 번쩍임·깜빡임·가림)은 값이 이어지는 걸로 전부 걸러진다.
       *
       * 후보 하나로 바로 확정하지 않고, 잠시 뒤 두 번째 값이 같은 카운트다운을
       * 이어가는지 본다 — 단발 오독이 설치가 되는 걸 막는다.
       */
      const last = lastReadRef.current
      const expected = last ? last.v - (now - last.t) / 1000 : null
      const cand = candRef.current

      if (cand) {
        const expCand = cand.v - (now - cand.t) / 1000
        if (Math.abs(reading.value - expCand) <= VALUE_TOL) {
          if (now - cand.t < CONFIRM_SPAN_MS) return
          // 새 카운트다운이 실제로 이어진다 — 설치 확정
          const at = (cand.startAt || cand.t) - Math.round(latencyRef.current)
          lastInstallRef.current = cand.startAt || cand.t
          indexRef.current += 1
          const next = { index: indexRef.current, at, rawAt: at }
          installRef.current = next
          trackerRef.current.reset()
          // 쿨타임이 도는 동안 새 설치는 물리적으로 불가능하다 (야누스 쿨 54~60초)
          lockUntilRef.current = lastInstallRef.current + NEW_CYCLE_LOCK_MS
          lastReadRef.current = { v: reading.value, t: now }
          candRef.current = null
          setInstall(next)
          log(`설치 감지 — 사이클 #${next.index} 시작`, `쿨타임 ${cand.v}초 등장`, 'ok')
          cbRef.current.onInstall?.(next)
        } else if (expected != null && Math.abs(reading.value - expected) <= VALUE_TOL) {
          // 옛 카운트다운이 그대로 이어진다 — 후보는 오독이었다
          candRef.current = null
          lastReadRef.current = { v: reading.value, t: now }
        } else {
          candRef.current = null
        }
        return
      }

      if (
        now >= lockUntilRef.current &&
        reading.value >= CAND_MIN_VALUE &&
        (expected == null ? freshRunRef.current : reading.value > expected + VALUE_TOL)
      ) {
        // 위로 점프한 값 — 새 설치 후보. 다음 읽기가 이어지는지 확인한 뒤 확정한다
        candRef.current = { v: reading.value, t: now, startAt: presenceStartRef.current }
      } else if (expected == null || Math.abs(reading.value - expected) <= VALUE_TOL) {
        // 이어지는 값 (또는 공유 도중 합류한 첫 값) — 흐름의 기준을 갱신한다
        lastReadRef.current = { v: reading.value, t: now }
      }
      // 그 외: 흐름과 안 맞는 단발 오독 — 무시한다
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
      setIconLost(lostSinceRef.current != null && Date.now() - lostSinceRef.current > DETECT.lostWarnMs)
      // 황혼은 쿨타임이 3초라 카운트다운으로 시각을 보정할 여지가 없다 — 보정 표시 자체를 쓰지 않는다
      setSync(modeRef.current === 'dusk' || !installRef.current
        ? null
        : (trackerRef.current.locked ? 'done' : 'pending'))

      /*
       * 황혼 — 한 바퀴가 끝나면 곧바로 다음 바퀴로 잇는다.
       *
       * 이 판단을 sample() 안에 두면 안 된다. 거기엔 아이콘을 못 알아봤을 때
       * 그냥 빠져나가는 return이 여러 개 있어서, 전투 이펙트로 인식이 흔들리는 순간과
       * 겹치면 이어붙이기가 통째로 건너뛰어진다(실제로 두어 번씩 씹혔다).
       * 인식과 무관하게 도는 이 타이머에서 처리해야 확실하다.
       *
       * 사냥을 아예 멈춘 경우(쿨타임이 한동안 전혀 없음)에는 잇지 않고 다음 쿨타임을 기다린다.
       */
      // 황혼 쿨타임을 실제로 '읽은' 적이 있어야 한다 — 금색 덩어리만으로는 시작하지 않는다
      const looksDusk = Date.now() - duskSeenAtRef.current <= DUSK_CONFIRM_TTL_MS
      if (modeRef.current === 'dusk' && looksDusk) {
        const now = Date.now()
        const activeRecently = now - lastDigitAtRef.current <= DUSK_ACTIVE_MS
        if (!installRef.current) {
          // 첫 사이클 — 쿨타임이 돌기 시작하면 시작
          if (activeRecently) startDuskCycle(lastDigitAtRef.current, '쿨타임 시작')
        } else if (now >= lockUntilRef.current) {
          /*
           * 한 바퀴가 끝났다. 상승엣지(숫자가 '새로' 뜨는 순간)를 기다리면 놓친다 —
           * 전투 이펙트로 숫자 인식이 들쭉날쭉해 엣지가 씹히면 다음 젠까지 밀렸다
           * (실측 영상: 끝난 뒤 16초 동안 쿨이 여러 번 돌았는데도 시작 안 됨).
           * 그래서 엣지가 아니라 "최근에 쿨타임이 돌고 있었나"만 본다.
           *
           * 시작 시각은 "사냥을 다시 시작한 순간" = 쿨타임을 마지막으로 본 시각이다.
           * 아이템은 공격할 때 떨어지므로 그 시점이 곧 새 2분의 기점이고, 표시도
           * 설정한 값에서 시작한다. 직전 알림 시각(lockUntil)에 맞추면 회수하느라
           * 쉰 만큼 표시가 작게 시작해(실측 2.9초) 설정과 어긋나 보였다.
           *
           * 단 사이클이 끝나기 '전에' 본 쿨타임은 기점이 될 수 없다 —
           * 그걸 쓰면 다시 과거로 앵커돼 같은 증상이 난다. 끝난 뒤에 본 것만 센다.
           */
          if (lastDigitAtRef.current >= lockUntilRef.current) {
            startDuskCycle(lastDigitAtRef.current, '이어서')
          }
        }
      }
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
    install, logs, error, iconLost, sync,
    // 공유가 끊기면 경고도 같이 내린다
    stale: stream ? stale : false,
    videoRef,
    start, stop, resetCycle, locate, log,
    hasTemplate: Boolean(loadTemplate()) || HAS_BUILTIN_ICON,
  }
}
