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
  /** 프레임이 이 시간(ms) 이상 안 들어오면 인식 실패로 경고 */
  staleWarnMs: 3000,
  /**
   * 지정할 때 기억해둔 아이콘 모양과 얼마나 닮았는지(-1~1).
   * 이 아래로 떨어지면 "야누스 아이콘이 그 자리에 없다"고 보고 판정을 아예 쉰다.
   * 다른 창에 가려지거나 퀵슬롯이 잠깐 사라졌을 때 그걸 설치로 오인하지 않기 위한 장치.
   * 쿨타임 숫자가 겹쳐도 통과해야 하므로 느슨하게 잡는다.
   */
  matchThreshold: 0.45,
  /** 이 시간(ms) 이상 못 알아보면 화면에 알린다 */
  lostWarnMs: 1500,
}

/**
 * 픽셀 배열 → 특징 벡터를 평균 0, 길이 1로 정규화.
 *
 * channel:
 *   luma   — 밝기. 설치 여부(어두워짐) 판정에 쓴다.
 *   chroma — 자주색 성분 (R+B)/2 − G. 화면에서 아이콘 자리를 찾을 때 쓴다.
 *     퀵슬롯 아이콘 위에는 단축키 글자와 숫자가 흰색·노란색으로 얹혀 밝기가 크게 흐트러진다.
 *     실측하면 밝기로는 0.16~0.33(잡음 수준)이지만 자주색 성분으로는 0.65~0.78이 나온다.
 *
 * 이렇게 두면 두 벡터의 내적이 곧 정규화 상호상관(NCC)이라,
 * 전체가 어두워지거나 밝아지는 변화에는 흔들리지 않고 "모양"만 비교하게 된다.
 */
export function toShapeVector(data, channel = 'luma') {
  const n = data.length / 4
  const v = new Float32Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const p = i * 4
    v[i] = channel === 'chroma'
      ? (data[p] + data[p + 2]) / 2 - data[p + 1]
      : 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    sum += v[i]
  }
  const mean = sum / n
  let norm = 0
  for (let i = 0; i < n; i++) {
    v[i] -= mean
    norm += v[i] * v[i]
  }
  norm = Math.sqrt(norm)
  if (norm < 1e-6) return null // 단색 — 비교할 모양이 없다
  for (let i = 0; i < n; i++) v[i] /= norm
  return v
}

/** 두 모양 벡터의 닮은 정도 (-1 ~ 1) */
export function shapeSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/* ── 템플릿 저장 ──────────────────────────────────────────── */

const TEMPLATE_KEY = 'maple.janus.template'

/**
 * { rgba, darkRgba?, tw, th, rw, rh }
 *   rgba     — 지정한 순간(사용 가능 상태)의 아이콘 픽셀
 *   darkRgba — 쿨타임이 도는 중의 모습. 어두워진 데다 숫자까지 겹쳐 모양이 꽤 달라서,
 *              이게 없으면 쿨타임 중에 화면 공유를 시작했을 때 아이콘을 못 찾는다.
 */
export function saveTemplate(tpl) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(tpl))
  } catch {
    // 용량 초과 등 — 저장 못 해도 이번 세션 동작에는 지장 없다
  }
}

export function loadTemplate() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    const t = raw && JSON.parse(raw)
    return t?.rgba?.length ? t : null
  } catch {
    return null
  }
}

/**
 * 기억해둔 모양을 지운다.
 *
 * 엉뚱한 자리를 지정한 채 저장되면 되돌릴 방법이 없었다 — 저장 모양은 자기 자신과
 * 맞춰보므로 점수가 1.0이라, 내장 원본이 진짜 아이콘을 0.89로 옳게 찾아도 매번 진다.
 * "다시 찾기"를 눌러도 같은 저장본을 다시 쓰니 영영 그 자리에 고정된다.
 */
export function clearTemplate() {
  try {
    localStorage.removeItem(TEMPLATE_KEY)
  } catch {
    // 지우지 못해도 이번 세션 동작에는 지장 없다
  }
}

/* ── 표시 ─────────────────────────────────────────────────── */

/** 초를 "17.4" 형태로 (소수 1자리, 음수는 0) */
export function formatSeconds(ms) {
  const s = Math.max(0, ms) / 1000
  return s.toFixed(1)
}

/* ── 설정 저장 ────────────────────────────────────────────── */

export const STORAGE_KEY = 'maple.janus.settings'

/*
 * 인게임에 보이는 지속시간 숫자는 아이콘이 어두워진 시점보다 조금 늦게 시작한다.
 *
 * 사용자 영상(1920×1080 한 사이클)에서 체력바 위 야누스 숫자의 전환 시각을 직접 쟀다.
 * 26→25가 설치 후 93.96초, 17→16이 설치 후 102.88초 — 두 지점 모두
 * **소멸 = 설치 + 118.9초**로 맞는다. 스킬 설명상 지속시간(120초)과 1.1초 차이다.
 * 이걸 빼지 않으면 알림이 딱 1초 늦게 울려 인게임 숫자가 한 칸 지나 있다.
 */
export const DURATION_LAG_MS = 1100

/*
 * 알림은 인게임 숫자가 설정값으로 **바뀌는 바로 그 순간**에 울린다.
 *
 * 이 알림은 확인용이 아니라 행동 개시 신호다 — 소리를 듣고 마지막 몸 젠을 잡고
 * 재설치를 시작하므로, 구간 한가운데(+0.5초)에서 울리면 매 사이클 그만큼씩 늦어져
 * 갈수록 밀린다(사용자가 실제로 겪고 18초로 당겨 쓰던 문제). 경계 정각에 울린다.
 */
export const ALARM_DISPLAY_BIAS_MS = 0

/**
 * 솔 야누스 모드.
 *
 * dawn(새벽)  — 설치기. 쿨타임 54~60초, 지속시간은 스킬 레벨로 정해진다.
 *               쿨타임 숫자가 위로 점프하는 순간이 곧 설치이므로 그걸로 사이클을 잡는다.
 * dusk(황혼)  — 설치기가 아니라 공격 시 맵 전역을 때리는 추가타. 쿨타임이 3초라
 *               숫자로는 사이클을 못 잡는다. 대신 바닥에 떨어진 아이템이 2분이면 사라지므로
 *               "쿨타임이 처음 도는 순간"부터 2분을 재고, 그동안은 재시작을 잠근다.
 *               한 바퀴가 끝나면 다시 감지해 같은 주기를 반복한다.
 */
export const MODE_LABELS = {
  dawn: '솔 야누스 : 새벽',
  dusk: '솔 야누스 : 황혼',
}

/** 황혼: 바닥 아이템이 사라지기까지 (초) */
export const DUSK_DURATION_SEC = 120

/** 설정 기준 한 사이클 길이(초) — 황혼은 레벨과 무관하게 아이템 소멸 시간 고정 */
export function durationForSettings(s) {
  return s?.mode === 'dusk' ? DUSK_DURATION_SEC : durationForLevel(s?.level)
}

/**
 * 설정 기준 지속시간 보정(ms).
 *
 * DURATION_LAG_MS는 **설치기(새벽)** 에서만 성립하는 값이다 —
 * "아이콘이 어두워진 순간"과 "인게임 지속시간 숫자가 시작하는 순간"의 시차를 잰 것.
 * 황혼은 설치기가 아니라 바닥에 떨어진 아이템의 2분이 기준이라 그 시차가 없다.
 * 여기에 1.1초를 빼면 설정한 알림초보다 그만큼 일찍 울린다(17초 설정 → 화면 101.9초).
 */
export function durationLagFor(s) {
  return s?.mode === 'dusk' ? 0 : DURATION_LAG_MS
}

export const DEFAULT_SETTINGS = {
  mode: 'dawn',
  level: 30,
  /**
   * 지속시간이 끝나기 몇 초 전에 알릴지.
   * 사냥터마다 젠 주기가 달라서 고정 프리셋 대신 직접 입력받는다.
   * (야누스가 끊기지 않으려면 몬스터를 잡자마자 다시 깔아야 해서 보통 2젠 전쯤)
   */
  offsetSec: 14,
  /** 목록에 없는 값이면 첫 번째 소리로 대체된다 (alarm.js resolveSound) */
  sound: null,
  volume: 0.7,
  /** 야누스 알림 소리 켜고 끄기 — 꺼도 감지·타이머 표시는 그대로 돈다 */
  alarmEnabled: true,
  /** 룬 등장 문구 감지 — 화면 공유 중에만 돈다 (야누스 영역 지정과는 무관) */
  runeEnabled: true,
  /** 야누스 알림과 구분되도록 따로 고른다. null이면 첫 번째 소리 */
  runeSound: null,
  /** 소리 크기는 알림마다 따로 — 음원별로 원래 크기가 달라 공용으로는 못 맞춘다 */
  runeVolume: 0.7,
  /**
   * VIP 부스터 종료 알림.
   * 축복룬 지속시간에는 부스터를 두 번 쓰는데, 첫 번째가 끝난 걸 놓치면 두 번째를 못 쓴다.
   * 알림은 남은시간이 0이 되는 순간에 울린다 — 다음 부스터를 쓰기까지 1분 가까운 여유가 있다.
   */
  boosterEnabled: true,
  boosterSound: null,
  boosterVolume: 0.7,
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

