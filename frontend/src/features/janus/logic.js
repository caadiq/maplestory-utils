/**
 * 야누스 쿨타임 알림 — 순수 로직
 *
 * 감지는 "퀵슬롯 야누스 아이콘의 밝기"만 본다.
 *  - 밝음 → 어두움 : 설치(사용). 사이클 시작
 *  - 어두움 → 밝음 : 쿨타임 종료. 이 구간 길이가 곧 실측 쿨타임
 * 쿨타임 숫자(OCR)는 쓰지 않는다. 어두운 구간을 재면 총 쿨타임이 그대로 나오기 때문에
 * 사이클마다 자동으로 재학습되고, 날마다 타이밍이 어긋나는 문제도 같이 해결된다.
 */

/** 스킬 레벨 → 지속시간(초). 사이 레벨은 선형 보간 */
const DURATION_POINTS = [
  [1, 60],
  [10, 70],
  [20, 80],
  [30, 120],
]

export function durationForLevel(level) {
  const lv = Number(level)
  if (!Number.isFinite(lv)) return null
  if (lv <= DURATION_POINTS[0][0]) return DURATION_POINTS[0][1]
  const last = DURATION_POINTS[DURATION_POINTS.length - 1]
  if (lv >= last[0]) return last[1]
  for (let i = 0; i < DURATION_POINTS.length - 1; i++) {
    const [x1, y1] = DURATION_POINTS[i]
    const [x2, y2] = DURATION_POINTS[i + 1]
    if (lv >= x1 && lv <= x2) {
      return Math.round(y1 + ((y2 - y1) * (lv - x1)) / (x2 - x1))
    }
  }
  return null
}

/* ── 감지 파라미터 ────────────────────────────────────────── */

export const DETECT = {
  /** 샘플링 주기(ms). 33ms면 초당 30번 — 0.03초 해상도 */
  intervalMs: 33,
  /** 밝기가 기준선 대비 이 비율 아래로 떨어지면 "어두움" */
  darkRatio: 0.78,
  /** 다시 이 비율 위로 올라오면 "밝음" (히스테리시스 — 경계에서 떨리는 것 방지) */
  brightRatio: 0.88,
  /**
   * 전환을 확정하기까지 그 상태가 유지돼야 하는 시간(ms). 방향마다 다르다.
   *
   * 어두워짐(설치)은 길게 본다 — 쿨타임이 끝날 때의 번쩍임처럼 순간적인 변화를
   * 설치로 오인하는 것이 실제로 발생한 오작동이기 때문.
   * 밝아짐(쿨타임 종료)은 짧게 본다 — 길게 잡으면 쿨이 돌자마자 바로 재설치했을 때
   * 밝은 구간이 확정되기 전에 다시 어두워져서 두 사이클이 하나로 합쳐진다.
   *
   * 확정이 늦어져도 시각은 "처음 넘어간 순간"으로 소급하므로 타이머 정확도는 그대로다.
   */
  confirmDarkMs: 1200,
  confirmBrightMs: 250,
  /** 이 시간(ms)보다 짧은 어두움은 쿨타임이 아니라 이펙트로 보고 버린다 */
  minCooldownMs: 3000,
  /** 프레임이 이 시간(ms) 이상 안 들어오면 인식 실패로 경고 */
  staleWarnMs: 3000,
  /**
   * 기준 밝기를 갱신할 때 받아들일 범위(기준 대비).
   * 쿨타임 종료 연출로 확 밝아진 값까지 기준에 섞이면 기준선이 올라가고,
   * 원래 밝기로 돌아왔을 때 "어두워졌다"고 잘못 판단하게 된다.
   */
  baselineAcceptLow: 0.85,
  baselineAcceptHigh: 1.15,
}

/** 캔버스 픽셀 배열의 평균 휘도(0~255) */
export function meanLuma(data) {
  let sum = 0
  const px = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 — 사람 눈에 보이는 밝기에 가깝다
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return px ? sum / px : 0
}

/* ── 쿨타임 학습 ──────────────────────────────────────────── */

/**
 * 새 측정값이 기존 추정과 너무 동떨어지면 표본에 넣지 않는다.
 * 렉이나 순간적인 오인식으로 나온 값 하나가 추정을 통째로 망가뜨리는 걸 막는다.
 */
export function isOutlier(ms, estimate) {
  if (estimate == null) return false
  return ms < estimate * 0.6 || ms > estimate * 1.6
}

/**
 * 최근 측정값들로 총 쿨타임을 추정한다.
 * 중앙값을 쓴다 — 렉으로 한 번 크게 튄 값이 평균을 끌고 가지 않게.
 */
export function estimateCooldown(samples) {
  if (!samples.length) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** 측정값들이 얼마나 흩어져 있는지(초) — 평균 오차 표시용 */
export function cooldownSpread(samples, estimate) {
  if (samples.length < 2 || estimate == null) return null
  const dev = samples.reduce((s, v) => s + Math.abs(v - estimate), 0) / samples.length
  return dev / 1000
}

/* ── 표시 ─────────────────────────────────────────────────── */

/** 초를 "17.4" 형태로 (소수 1자리, 음수는 0) */
export function formatSeconds(ms) {
  const s = Math.max(0, ms) / 1000
  return s.toFixed(1)
}

/** "오후 9시 14분 02초" — 사이트 다른 화면과 같은 표기 */
export function formatClock(ts) {
  const d = new Date(ts)
  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = d.getMinutes()
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${ampm} ${h12}시 ${mm}분 ${ss}초`
}

/** 로그용 짧은 시각 "9:14:02" */
export function formatLogTime(ts) {
  const d = new Date(ts)
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/* ── 설정 저장 ────────────────────────────────────────────── */

export const STORAGE_KEY = 'maple.janus.settings'

export const DEFAULT_SETTINGS = {
  level: 30,
  /** 쿨타임 종료 몇 초 전에 알릴지 */
  offsetSec: 12,
  sound: 'bell',
  volume: 0.7,
  /** 학습 전에 쓸 총 쿨타임(초). null이면 첫 사이클은 측정만 하고 알리지 않는다 */
  manualCooldownSec: null,
  titleBlink: true,
  browserNotify: false,
  notifyDurationEnd: true,
  /** 미니바(HUD) 표시 여부 */
  hudVisible: true,
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 사파리 프라이빗 모드 등 — 저장 실패해도 동작에는 지장 없음
  }
}

export const OFFSET_PRESETS = [5, 12, 20]

export const SOUND_OPTIONS = [
  { value: 'bell', label: '벨' },
  { value: 'beep', label: '비프' },
  { value: 'chime', label: '차임' },
]
