import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DETECT, toShapeVector, shapeSimilarity,
  saveTemplate, loadTemplate,
  saveCooldownSec, loadCooldownSec, joinElapsedMs,
} from './logic'
import { LOCATE, candidateSizes, probeSizes, normalize, toChroma, toLumaPlane, locateIcon, shiftRegion } from './locateCore'
import { learnIconSize } from './uiCalibration'
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
  const worker = locateWorker
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
      finish(e.data.hits || [])
    }
    /*
     * 워커 스크립트 로드 실패는 error 이벤트로만 온다. 안 받으면 이 Promise가
     * 영원히 안 끝나서 "아이콘을 찾는 중…" 전체 화면 오버레이가 영구히 남는다.
     * 그 자리에서 직접 계산으로 대체한다.
     */
    const onError = () => {
      worker.terminate()
      if (locateWorker === worker) locateWorker = null
      finish(locateIcon(payload))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    /*
     * 무응답 안전장치. 그냥 포기만 하면 안 된다 — 워커는 모듈 전역 하나뿐이라,
     * 아직 돌고 있는 계산 뒤에 재시도가 계속 쌓여 점점 더 밀린다. 끊고 새로 만든다.
     */
    timer = setTimeout(() => {
      worker.terminate()
      if (locateWorker === worker) locateWorker = null
      finish([])
    }, 15000)
    worker.postMessage({ id, payload })
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
  const hit = Object.entries(iconFiles).find(([p]) => p.includes(`janus-${mode}.`))
  return hit?.[1] ?? Object.values(iconFiles)[0] ?? null
}
/** icon/ 폴더에 있는 janus-* 파일 이름들 — 파일만 추가하면 탐색에 자동 포함된다 */
const builtinModes = () => Object.keys(iconFiles)
  .map((p) => p.match(/janus-([a-z0-9]+)\./)?.[1])
  .filter(Boolean)
export const HAS_BUILTIN_ICON = Object.keys(iconFiles).length > 0

/**
 * 템플릿 벡터 캐시 (key|크기|평면 → 정규화 벡터).
 * 쿨타임 모습까지 넣으면 템플릿이 수십 장이라 매 탐색마다 다시 만들면 캔버스 작업만
 * 수천 번이다. 원본이 안 바뀌면 결과도 같으므로 그대로 재사용한다.
 */
const vecCache = new Map()
/**
 * 저장 모양이 바뀌면 캐시가 갈리도록 내용에서 뽑는 도장.
 * 저장본은 늘 24×24라 크기로는 구분이 안 된다 — 픽셀을 성기게 훑어 더한다.
 */
const savedStamp = (rgba) => {
  let sum = 0
  for (let i = 0; i < rgba.length; i += 37) sum = (sum + rgba[i] * (i + 1)) % 2147483647
  return `${rgba.length}.${sum}`
}

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

export function useJanusDetector({ onInstall, onModeMismatch, onIconLostTooLong, onModeDetected, mode = 'dawn', cycleMs = 0, enabled = true }) {
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
  // region을 잡았을 때의 캡처 크기 — 창 크기가 바뀌면 우하단 기준으로 위치를 보정한다
  const regionBaseRef = useRef(null)
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
  /** 설치 순간에 뜨는 쿨타임 값 = 총 길이. 쿨감에 따라 사람마다 달라 기억해 둔다 */
  const cooldownSecRef = useRef(loadCooldownSec())
  /** 쿨타임 도중 합류했을 때, 숫자가 바뀌는 순간을 잡기 위한 직전 읽기 */
  const joinRef = useRef(null)
  const freshRunRef = useRef(false)     // 이번 "숫자 보임" 구간이 진짜 부재 뒤에 시작됐는지
  const latencyRef = useRef(0)       // 화면 공유 파이프라인 지연(ms)
  const templateRef = useRef(null)   // 지정할 때 기억한 아이콘 모양
  const darkAccRef = useRef({ sum: new Float64Array(24 * 24 * 4), n: 0, at: 0 }) // 쿨타임 중 모습 평균
  const builtinIconsRef = useRef({}) // icon/ 폴더의 원본 (모드별)
  const modeRef = useRef(mode)
  const cycleMsRef = useRef(cycleMs)
  const lostSinceRef = useRef(null)
  /* 새벽/황혼 자동 전환 — 마지막 확인 시각과 연속으로 같게 나온 횟수 */
  const modeCheckedAtRef = useRef(0)
  const modeVoteRef = useRef({ mode: null, n: 0 })
  const modeVecsRef = useRef(null)
  const lostFiredAtRef = useRef(0)
  const indexRef = useRef(0)
  const lastFrameRef = useRef(0)
  const bigReadingRef = useRef(null) // 황혼 모드에서 읽힌 '큰 쿨타임' — 모드 불일치 판단용
  const duskSeenAtRef = useRef(0)    // 황혼다운 쿨타임 값(1~3)을 마지막으로 '읽은' 시각

  const cbRef = useRef({ onInstall, onModeMismatch, onIconLostTooLong, onModeDetected })
  useEffect(() => { cbRef.current = { onInstall, onModeMismatch, onIconLostTooLong, onModeDetected } })

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
    // icon/ 폴더의 janus-* 전부 — dawn/dusk 원본에 더해 cooldown* (쿨타임 중 실물 모습들).
    // 원본만으로는 쿨타임 장면에서 NCC가 0.05~0.32로 추락해 아예 못 찾는다(실측).
    for (const m of builtinModes()) {
      const url = iconByMode(m)
      if (!url || builtinIconsRef.current[m]) continue
      const img = new Image()
      img.src = url
      builtinIconsRef.current[m] = img
    }
  }, [])

  useEffect(() => {
    modeRef.current = mode
    cycleMsRef.current = cycleMs
    /*
     * 황혼 사이클 진행 중에 알림초를 바꾸면 사이클 길이(cycleMs)가 변하는데,
     * 잠금은 시작 시점 스냅샷이라 옛 길이로 남는다 — 알림이 조기 취소되거나
     * 다음 사이클이 옛 잠금까지 지연됐다. 진행 중이면 잠금도 같이 옮긴다.
     */
    if (mode === 'dusk' && installRef.current && lastInstallRef.current) {
      lockUntilRef.current = lastInstallRef.current + cycleMs
    }
  }, [mode, cycleMs])

  const log = useCallback((message, tag, tagColor) => {
    setLogs((prev) => [{ at: Date.now(), message, tag, tagColor }, ...prev].slice(0, MAX_LOGS))
  }, [])

  /* ── 화면 공유 시작/중지 ────────────────────────────────── */

  const resetDetector = () => {
    lastReadRef.current = null
    candRef.current = null
    joinRef.current = null
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
    bigReadingRef.current = null
    duskSeenAtRef.current = 0
  }

  const start = useCallback(async () => {
    setError(null)
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        // 창 목록이 먼저 뜨게 하는 힌트. 어떤 창을 고를지는 브라우저 UI에서 사용자가 정한다
        video: { displaySurface: 'window', frameRate: { ideal: 30 } },
        audio: false,
      })
      // 브라우저의 '공유 중지' 바로 끊겨도 앱의 중단 버튼과 같은 정리를 거친다.
      // setStream(null)만 하면 install·잠금이 남아 PiP가 유령 카운트다운을 계속 돌리고,
      // 재공유 시 낡은 상태가 새 세션으로 이월된다.
      media.getVideoTracks()[0]?.addEventListener('ended', () => {
        setStream(null)
        resetDetector()
        lastInstallRef.current = 0
        installRef.current = null
        trackerRef.current.reset()
        setInstall(null)
        log('화면 공유가 중단되었습니다', '연결 끊김', 'warn')
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
    resetDetector()
    lastInstallRef.current = 0
    installRef.current = null
    trackerRef.current.reset()
    setInstall(null)
  }, [stream])

  /*
   * 알림을 끄면 감지를 멈추고 진행 중인 사이클도 지운다.
   * 감지만 멈추고 사이클을 남기면 화면에 카운트다운이 그대로 흐르고,
   * 다시 켰을 때 이미 끝난 옛 사이클이 되살아난다.
   */
  useEffect(() => {
    if (enabled) return
    resetDetector()
    lastInstallRef.current = 0
    installRef.current = null
    trackerRef.current.reset()
    setInstall(null)
    setIconLost(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

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
    // ignoreSaved: 저장 모양이 엉뚱한 자리에 굳었을 때 내장 원본으로만 다시 찾는다
    const saved = ignoreSaved ? null : loadTemplate()
    /*
     * 정련은 원본 그대로가 아니라 최대 폭까지만 줄여서 본다.
     * 4K를 그대로 보면 아이콘이 90px이라 창이 1080p의 4배가 되어 한 번에 20초가 걸렸다.
     * 좌표는 정규화해서 돌려주므로 줄여 본 것이 밖으로 드러나지 않는다.
     */
    const fw2 = Math.min(vw, LOCATE.maxFullWidth)
    const fullScale = fw2 / vw
    const fh2 = Math.round(vh * fullScale)
    // 직접 지정한 적이 있으면 그때의 크기를 먼저 쓴다 — 추측보다 확실한 정보다
    const savedSize = saved ? Math.round(saved.rw * fw2) : null
    const sizes = [...new Set([
      ...(savedSize && savedSize >= 10 ? [savedSize] : []),
      ...candidateSizes(fw2, fh2),
    ])].sort((a, b) => a - b)
    const probes = savedSize ? [...new Set([savedSize, ...probeSizes(sizes)])] : probeSizes(sizes)
    /*
     * 축소 폭은 "성긴 단계에서 가장 작은 후보가 ~13px은 되게" 정한다.
     * 640 고정은 1920 화면·45px 아이콘 기준 15px였는데, 확장 UI 대응으로 후보 하한이
     * 26px까지 내려가면서 640으로는 8px대로 뭉개져 성긴 단계가 놓칠 수 있다.
     */
    const frameWidth = Math.min(fw2, Math.max(LOCATE.frameWidth, Math.ceil((fw2 * 13) / sizes[0])))
    const ratio = frameWidth / fw2

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

    const coarse = grabFrame(frameWidth)
    const full = grabFrame(fw2)
    if (!coarse || !full) return null

    /**
     * source를 size×size로 줄여 정규화한 벡터를 만든다 (자주색·밝기).
     * 쿨타임 모습까지 넣으면 템플릿이 수십 장이라 (장수 × 크기 × 평면)만큼 캔버스를
     * 돌리게 된다 — 원본이 바뀌지 않는 한 결과도 같으므로 key별로 재사용한다.
     */
    /*
     * 크기마다 캔버스를 하나씩 두고 돌려 쓴다.
     * 템플릿 수십 장 × 크기 수십 개면 (만들기 + 크기 바꾸기)만으로 수천 번인데,
     * 캔버스 크기 변경은 내부 버퍼를 새로 잡는 일이라 그때마다 비용이 든다.
     */
    const scratches = new Map()
    const scratchAt = (size) => {
      let c = scratches.get(size)
      if (!c) {
        c = document.createElement('canvas')
        c.width = size
        c.height = size
        scratches.set(size, c)
      }
      return c
    }
    const vecAt = (key, source, sw, sh, size, plane = toChroma) => {
      const ck = `${key}|${size}|${plane === toChroma ? 'c' : 'l'}`
      if (vecCache.has(ck)) return vecCache.get(ck)
      const tctx = scratchAt(size).getContext('2d', { willReadFrequently: true })
      tctx.clearRect(0, 0, size, size)
      tctx.drawImage(source, 0, 0, sw, sh, 0, 0, size, size)
      const v = normalize(plane(tctx.getImageData(0, 0, size, size).data))
      vecCache.set(ck, v)
      return v
    }

    /*
     * 저장된 모양과 내장 원본을 전부 넘긴다. 자리마다 전부 대조해 가장 잘 맞는 하나를
     * 그 자리 점수로 삼으므로 섞여서 흐려질 일이 없고, 저장본이 잘못됐어도(쿨타임 중에
     * 지정해서 어두운 모습이 기준이 된 경우) 원본이 받쳐 준다 —
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
      if (saved.rgba?.length) sources.push({ ...toCanvas(saved.rgba), key: `saved${savedStamp(saved.rgba)}` })
      // 쿨타임 중 모습도 저장돼 있으면 같이 훑는다
      if (saved.darkRgba?.length) sources.push({ ...toCanvas(saved.darkRgba), key: `savedDark${savedStamp(saved.darkRgba)}` })
    }
    /*
     * 내장 원본은 새벽·황혼에 더해 **쿨타임 중 실물 모습들**(janus-cooldown*)까지 넣는다.
     * 원본만으로는 쿨타임 장면에서 일치도가 0.26~0.44로 추락해 통과선(0.45) 아래였다.
     * 숫자가 매초 바뀌어 한두 장으로는 어느 순간에도 안 맞으므로 새벽 48장을 넣었고,
     * 그 결과 612프레임 실측에서 1위 정답 95.1% → 99.2%, 바로 확정 83.2% → 98.9%가 됐다
     * (자세한 내용은 icon/README.md).
     * 쿨타임 모습은 모드 구분에는 못 쓴다(mode: null) — 자리만 잡는다.
     */
    for (const m of builtinModes()) {
      const img = builtinIconsRef.current[m]
      if (!img) continue
      if (!img.complete) {
        // 공유 시작 직후에는 아직 로딩 중일 수 있다 — 빠지면 저장 모양만으로 훑게 되니 기다린다
        await img.decode().catch(() => {})
      }
      if (img.complete && img.naturalWidth) {
        sources.push({
          el: img, w: img.naturalWidth, h: img.naturalHeight,
          key: m,
          mode: m.startsWith('cooldown') ? null : m,
        })
      }
    }
    if (!sources.length) return null

    // 크기별 템플릿을 미리 만들어 워커로 넘긴다 (워커에는 캔버스가 없다)
    const templates = sources.map((src) => {
      const vecs = {}
      const coarseVecs = {}
      const lumaVecs = {}
      for (const size of sizes) {
        const v = vecAt(src.key, src.el, src.w, src.h, size)
        if (v) vecs[size] = v
        // 채점용 밝기 벡터 — 자주색만으로는 보라 계열 아이콘끼리 안 갈린다
        const l = vecAt(src.key, src.el, src.w, src.h, size, toLumaPlane)
        if (l) lumaVecs[size] = l
      }
      const coarseLumaVecs = {}
      for (const size of probes) {
        const n = Math.max(6, Math.round(size * ratio))
        const v = vecAt(src.key, src.el, src.w, src.h, n)
        if (v) coarseVecs[size] = v
        // 자리를 줄 세울 때 밝기까지 보기 위한 것 (locateCore collectSpots 참고)
        const l = vecAt(src.key, src.el, src.w, src.h, n, toLumaPlane)
        if (l) coarseLumaVecs[size] = l
      }
      return { vecs, coarseVecs, coarseLumaVecs, lumaVecs, mode: src.mode ?? null }
    })

    /*
     * 모든 모양을 한 번에 대조한다.
     *
     * 예전에는 모양마다 탐색을 따로 돌리고 "어느 쪽 결과가 더 깔끔한가"로 한 벌만
     * 골랐다. 그 고르기가 엇나가면 정답을 찾아 놓고도 버렸다 — 확장 UI 영상 312장 중
     * 14장이 그렇게 날아갔다(실측). 지금은 자리마다 전 모양을 채점해 가장 잘 맞는
     * 모양의 점수를 그 자리 점수로 삼으므로, 고를 일 자체가 없다.
     */
    const hits = await runLocate({ coarse, full, templates, sizes, probes, ratio })
    if (!hits.length) return { learned: Boolean(saved), hits: [] }

    return {
      // 직접 지정해 저장한 모양인지 — 확신 기준이 달라진다
      learned: Boolean(saved),
      // 이긴 모양이 내장 원본일 때만 모드를 알 수 있다 (저장 모양·쿨타임 모습엔 모드가 없다)
      detectedMode: hits[0].mode ?? null,
      // 줄여 본 좌표를 화면 비율로 되돌린다 (아래에서 다시 원본 픽셀로 환산된다)
      hits: hits.map((c) => ({
        score: c.score,
        region: { x: c.x / full.w, y: c.y / full.h, w: c.w / full.w, h: c.h / full.h },
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
    /*
     * 영역이 정해진 순간이 UI 배율의 실측이다 (아이콘 기본 32px ÷ 찾은 크기).
     * 룬·부스터가 이 값을 물려받는다 — 확장 UI처럼 창 크기로 배율을 예측할 수
     * 없는 화면에서, 저쪽 감지기들의 템플릿 크기를 맞추는 근거가 된다.
     */
    const video = videoRef.current
    if (region && video?.videoWidth) {
      regionBaseRef.current = { w: video.videoWidth, h: video.videoHeight }
      learnIconSize(region.w * video.videoWidth, video.videoWidth, video.videoHeight)
    }
  }, [region])

  /*
   * 창 크기가 바뀌어도 지정 영역을 **처음 찾은 픽셀 자리에 그대로 둔다**.
   *
   * region이 0~1 비율 좌표라 아무것도 안 하면 고정이 아니다 — 캡처가 커진 만큼
   * 같은 비율 자리가 아래로 내려간다(실사용 보고: 창 +86px에 상자도 +86px).
   * 예전에는 우하단 기준으로 옮겨 보려 했는데, 창을 늘려도 게임이 그만큼 안 커지고
   * 여백만 생기는 경우가 있어 오히려 여백 속으로 밀어 넣었다.
   *
   * 퀵슬롯이 실제로 움직이는 배치라면(게임이 창을 따라 다시 그리는 경우) 모양 판정이
   * 어긋나고, 6초 뒤 자동 재탐색이 알아서 다시 잡는다 — 그 길이 이미 있으므로
   * 여기서 추측으로 옮길 이유가 없다.
   */
  useEffect(() => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    const onResize = () => {
      const r = regionRef.current
      const base = regionBaseRef.current
      const w = video.videoWidth
      const h = video.videoHeight
      if (!r || !base || !w || !h) return
      if (w === base.w && h === base.h) return
      setRegion(shiftRegion(r, base, { w, h }))
      regionBaseRef.current = { w, h }
      log(`창 크기 변경 (${base.w}×${base.h} → ${w}×${h}) — 영역은 그 자리에 고정`, '자동', 'muted')
    }
    video.addEventListener('resize', onResize)
    return () => video.removeEventListener('resize', onResize)
  }, [stream, log])


  useEffect(() => {
    if (!stream || !region || !enabled) return

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

    /**
     * 지정된 자리가 새벽인지 황혼인지 — 내장 원본 둘과 대조한다.
     *
     * 실측(24×24): 새벽 대기 dawn 0.823 / dusk 0.363, 황혼 대기 dusk 0.885 / dawn 0.411.
     * 쿨타임 중에는 아이콘이 어두워지고 숫자가 얹혀 둘 다 0 근처로 떨어지므로,
     * 통과선(modeScore)에 걸려 저절로 판단을 쉰다.
     */
    const detectMode = (pixels) => {
      if (!modeVecsRef.current) {
        const built = {}
        for (const m of ['dawn', 'dusk']) {
          const img = builtinIconsRef.current[m]
          if (!img?.complete || !img.naturalWidth) return null // 아직 로딩 중 — 다음 기회에
          const c = document.createElement('canvas')
          c.width = 24
          c.height = 24
          const cc = c.getContext('2d', { willReadFrequently: true })
          cc.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, 24, 24)
          const data = cc.getImageData(0, 0, 24, 24).data
          built[m] = { luma: toShapeVector(data), chroma: toShapeVector(data, 'chroma') }
        }
        modeVecsRef.current = built
      }
      const vecs = modeVecsRef.current
      const luma = toShapeVector(pixels)
      const chroma = toShapeVector(pixels, 'chroma')
      /*
       * 자주색과 밝기를 함께 본다 — 새벽·황혼은 둘 다 보라 계열이라
       * 자주색만으로는 덜 갈리고, 밝기가 모양 차이를 확실하게 잡아 준다.
       */
      const scoreOf = (m) => (shapeSimilarity(chroma, vecs[m].chroma) + shapeSimilarity(luma, vecs[m].luma)) / 2
      const dawn = scoreOf('dawn')
      const dusk = scoreOf('dusk')
      const [win, top, other] = dawn >= dusk ? ['dawn', dawn, dusk] : ['dusk', dusk, dawn]
      if (top < DETECT.modeScore || top - other < DETECT.modeMargin) return null
      return win
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
        /*
         * 단색이면 기준으로 삼지 않는다.
         *
         * toShapeVector는 단색 창에 null을 준다. 그대로 두면 templateRef가 계속 비어 있어
         * 이 블록이 **매 프레임(33ms) 다시 돌면서** saveTemplate을 호출한다 —
         * 초당 30번 localStorage에 쓰고, 멀쩡히 저장돼 있던 기준 모양을 단색으로 덮는다.
         * 창을 늘려 지정 영역이 검은 여백에 앉으면 실제로 이 상태가 된다.
         */
        const first = toShapeVector(pixels)
        if (!first) return
        templateRef.current = first
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

      /*
       * 새벽/황혼이 바뀌었는지 본다.
       *
       * 같은 칸의 스킬을 갈아 끼우면 자리는 그대로인데 모드만 달라진다. 예전에는
       * 아이콘을 6초 이상 못 알아본 뒤 재탐색이 돌 때만 알아챘는데, 그러면 그동안
       * 엉뚱한 모드의 타이머가 돈다. 자리는 이미 아는 상태이므로 그 자리를 내장
       * 원본 둘과 대조하기만 하면 되고, 24×24 벡터 두 번이라 사실상 공짜다.
       */
      if (now - modeCheckedAtRef.current >= DETECT.modeCheckMs) {
        modeCheckedAtRef.current = now
        const detected = detectMode(pixels)
        if (detected) {
          const vote = modeVoteRef.current
          modeVoteRef.current = detected === vote.mode ? { mode: detected, n: vote.n + 1 } : { mode: detected, n: 1 }
          if (modeVoteRef.current.n >= DETECT.modeVotes && detected !== modeRef.current) {
            modeVoteRef.current = { mode: detected, n: 0 }
            cbRef.current.onModeDetected?.(detected)
          }
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

      // 값까지 제대로 읽힌 짧은 쿨타임 = 진짜 황혼이라는 증거
      // (우하단 스택 배지는 digits.js에서 위치로 걸러지므로 여기까지 오지 않는다)
      // 새벽 카운트다운의 꼬리(5→1초)도 값은 작으므로, 황혼 모드일 때만 증거로 삼는다.
      if (modeRef.current === 'dusk' && reading && reading.value <= DUSK_MAX_VALUE) {
        duskSeenAtRef.current = now
        bigReadingRef.current = null // 정상 황혼 값이 확인되면 오전환 무장도 푼다
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
        /*
         * 두 번의 큰 값은 서로 '가까워야' 한다. 상한 없이 두면 무장이 세션 내내 남아,
         * 몇 분 간격의 단발 오독 두 번만으로 사냥 중에 모드가 넘어가 버린다.
         * 창을 벗어난 큰 값은 새 1번째 관측으로 다시 센다.
         */
        const prev = bigReadingRef.current
        if (prev && now - prev > 400 && now - prev < 3000) {
          bigReadingRef.current = null
          log(`쿨타임 ${reading.value}초 — 황혼이 아니라 새벽 아이콘입니다`, '모드 교정', 'warn')
          cbRef.current.onModeMismatch?.('dawn')
          return
        }
        if (!prev || now - prev >= 3000) bigReadingRef.current = now
      }

      if (similarity < DETECT.matchThreshold && !digitCount) {
        // 못 알아보는 동안에는 상태를 건드리지 않고 그대로 얼려둔다
        if (lostSinceRef.current == null) lostSinceRef.current = now
        return
      }
      lostSinceRef.current = null

      // 숫자가 바뀌는 순간에 맞춰 설치 시각을 되돌린다.
      // 화면 공유 지연이나 아이콘이 어두워지기까지의 시차와 무관하게 스스로 맞는다.
      // 황혼은 보정 대상이 아니다 — 3→2→1 카운트다운이 규칙을 만족해 버려서
      // 사이클 앵커가 쿨마다 ±0.5초씩 무작위로 점프했다(1초 격자와 무관한 앵커라 shift가 무의미).
      if (installRef.current && !trackerRef.current.locked && modeRef.current !== 'dusk') {
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
          // 설치 순간에 뜬 값이 곧 쿨타임 총 길이 — 다음에 쿨타임 중간부터 합류할 때 쓴다
          cooldownSecRef.current = cand.v
          saveCooldownSec(cand.v)
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

      /*
       * 쿨타임이 도는 중에 합류한 경우 — 남은 숫자로 설치 시각을 역산해 사이클을 잇는다.
       *
       * 설치 판별은 "숫자가 위로 점프"만 보므로, 쿨타임 도중에 공유를 켜면 다음 설치까지
       * (새벽 30레벨이면 최대 2분) 타이머가 아예 안 돌았다.
       *
       * 총 길이는 쿨감 장비에 따라 사람마다 달라 고정할 수 없다 — 설치를 한 번이라도
       * 감지했으면 그때 뜬 값을 기억해 두었다가 여기서 쓴다(없으면 이번엔 못 잇는다).
       *
       * 시각은 **숫자가 바뀌는 순간**을 기다렸다가 잡는다. 그 순간의 남은 시간은 정확히
       * 그 숫자이므로, 지금 보이는 값을 그대로 쓰는 것(최대 1초 오차)보다 훨씬 정확하다.
       */
      const idle = !installRef.current
        || now - installRef.current.at >= (cycleMsRef.current || 0)
      if (idle && now >= lockUntilRef.current) {
        const total = cooldownSecRef.current
        const prev = joinRef.current
        const elapsed = joinElapsedMs(prev, reading.value, now, total)
        if (total && reading.value >= 1 && reading.value <= total) {
          if (elapsed != null) {
            // 숫자가 막 바뀐 지금, 남은 시간은 정확히 reading.value 초다
            const at = now - elapsed - Math.round(latencyRef.current)
            indexRef.current += 1
            const next = { index: indexRef.current, at, rawAt: at }
            installRef.current = next
            lastInstallRef.current = at
            trackerRef.current.reset()
            lockUntilRef.current = at + NEW_CYCLE_LOCK_MS
            lastReadRef.current = { v: reading.value, t: now }
            candRef.current = null
            joinRef.current = null
            setInstall(next)
            log(
              `쿨타임 ${reading.value}초 — 이어서 사이클 #${next.index} 시작`,
              `설치 ${Math.round((now - at) / 1000)}초 전 (쿨타임 ${total}초 기준 추정)`,
              'ok',
            )
            cbRef.current.onInstall?.(next)
            return
          }
          if (!prev || reading.value !== prev.v) joinRef.current = { v: reading.value, t: now }
        }
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
      /*
       * 오래 못 알아보면 위치가 어긋난 것일 수 있다 — 위에 알린다(자동 재탐색용).
       *
       * 위치가 어긋나는 데는 창 크기 변경 이벤트로 못 잡는 경우가 있다:
       * 해상도 확장으로 창이 커져도 캡처 트랙 해상도는 그대로이고 **내용만
       * 줄어들며 레터박스가 생기는** 환경(실사용 보고). 좌표 보정으로는 시점을
       * 알 수 없으니, "아이콘을 놓친 상태가 지속된다"를 신호로 쓴다.
       * 몹·창에 잠깐 가리는 정도(수 초)는 발화하지 않고, 발화 뒤에는 한동안 쉰다.
       */
      if (lostSinceRef.current != null && Date.now() - lostSinceRef.current > 6000) {
        if (Date.now() - (lostFiredAtRef.current || 0) > 45000) {
          lostFiredAtRef.current = Date.now()
          cbRef.current.onIconLostTooLong?.()
        }
      }
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
      /*
       * 기준은 '값이 읽힌' 쿨타임 하나다. 금색 덩어리(digitCount)는 이펙트·배지도
       * 세므로 그걸 재시작 기준으로 쓰면, 사냥을 멈춘 뒤 이펙트가 스치기만 해도
       * 실제 쿨타임 없이 새 2분이 시작됐다. 황혼 값(1~3)은 쿨이 도는 내내 읽히므로
       * 이 기준으로도 이어붙이기가 끊기지 않는다.
       */
      if (modeRef.current === 'dusk') {
        const now = Date.now()
        const activeRecently = now - duskSeenAtRef.current <= DUSK_ACTIVE_MS
        if (!installRef.current) {
          // 첫 사이클 — 쿨타임이 돌기 시작하면 시작
          if (activeRecently) startDuskCycle(duskSeenAtRef.current, '쿨타임 시작')
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
          if (duskSeenAtRef.current >= lockUntilRef.current) {
            startDuskCycle(duskSeenAtRef.current, '이어서')
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
  }, [stream, region, log, enabled])

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
