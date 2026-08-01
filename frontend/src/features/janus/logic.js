/**
 * 야누스 알림 — 순수 로직
 *
 * 퀵슬롯 야누스 아이콘이 어두워지는 순간(= 설치)만 감지하고,
 * 그 뒤로는 스킬 레벨로 정해지는 지속시간을 타이머로 센다.
 *
 * 쿨타임은 보지 않는다. 지속시간(30렙 2분)보다 쿨타임이 짧아서 야누스가 사라지기 전에
 * 이미 쿨이 돌아와 있고, 실제로 필요한 알림은 "지속시간이 끝나기 전"이기 때문이다.
 */

/**
 * 스킬 레벨 → 지속시간(초).
 * 10레벨 단위 계단식이다 — 보간하지 않는다. 1~9는 전부 60초, 10~19는 전부 70초.
 */
const DURATION_TIERS = [
  { min: 30, sec: 120 },
  { min: 20, sec: 80 },
  { min: 10, sec: 70 },
  { min: 1, sec: 60 },
]

/** 드롭다운용 — 정확한 레벨보다 어느 구간인지가 전부다 */
export const LEVEL_TIERS = [
  { value: 1, label: '1~9레벨', sub: '60초' },
  { value: 10, label: '10~19레벨', sub: '70초' },
  { value: 20, label: '20~29레벨', sub: '80초' },
  { value: 30, label: '30레벨', sub: '120초' },
]

/** 저장된 레벨이 속한 구간의 대표값 (예: 25 → 20) */
export function tierForLevel(level) {
  const lv = Math.floor(Number(level))
  return DURATION_TIERS.find((t) => lv >= t.min)?.min ?? 1
}

export function durationForLevel(level) {
  const lv = Math.floor(Number(level))
  if (!Number.isFinite(lv)) return null
  return DURATION_TIERS.find((t) => lv >= t.min)?.sec ?? DURATION_TIERS[DURATION_TIERS.length - 1].sec
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
   * 전환을 확정하기까지 그 상태가 유지돼야 하는 시간(ms).
   *
   * 게임 아이콘은 쿨타임 막바지 약 5초 동안 숫자가 사라지고 깜빡인다.
   * 그 깜빡임을 상태 전환으로 받아들이지 않으려면 확정 시간이 깜빡임 한 주기보다 길어야 한다.
   * 재설치는 쿨이 돈 직후가 아니라 지속시간이 끝나갈 때 하므로 넉넉히 잡아도 설치를 놓치지 않는다.
   *
   * 확정이 늦어져도 시각은 "처음 넘어간 순간"으로 소급하므로 타이머 정확도는 그대로다.
   */
  confirmDarkMs: 1200,
  confirmBrightMs: 1500,
  /** 프레임이 이 시간(ms) 이상 안 들어오면 인식 실패로 경고 */
  staleWarnMs: 3000,
  /**
   * 기준 밝기를 갱신할 때 받아들일 범위(기준 대비).
   * 쿨타임이 끝날 때의 연출로 확 밝아진 값까지 기준에 섞이면 기준선이 올라가고,
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
  /**
   * 지속시간이 끝나기 몇 초 전에 알릴지.
   * 사냥터마다 젠 주기가 달라서 고정 프리셋 대신 직접 입력받는다.
   * (야누스가 끊기지 않으려면 몬스터를 잡자마자 다시 깔아야 해서 보통 2젠 전쯤)
   */
  offsetSec: 14,
  sound: 'ppyorong',
  volume: 0.7,
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

