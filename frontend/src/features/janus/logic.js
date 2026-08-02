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
   * 깜빡임의 밝은 구간이 확정 시간을 넘기면 "쿨타임 끝"으로 읽히고,
   * 이어지는 어두운 구간이 새 설치로 잡혀 타이머가 도중에 다시 시작된다.
   * 그래서 밝아짐 확정을 깜빡임 한 주기보다 넉넉히 잡는다.
   * 재설치는 쿨이 돈 직후가 아니라 지속시간이 끝나갈 때 하므로 이래도 설치를 놓치지 않는다.
   *
   * 확정이 늦어져도 시각은 "처음 어두워지기 시작한 순간"으로 소급하므로 타이머 정확도는 그대로다.
   * 어두워짐 쪽을 짧게 잡은 이유는 정확도가 아니라 반응 속도다 — 화면에 타이머가 뜨는 게 늦어 보인다.
   */
  confirmDarkMs: 600,
  confirmBrightMs: 2200,
  /** 프레임이 이 시간(ms) 이상 안 들어오면 인식 실패로 경고 */
  staleWarnMs: 3000,
  /**
   * 지정할 때 기억해둔 아이콘 모양과 얼마나 닮았는지(-1~1).
   * 이 아래로 떨어지면 "야누스 아이콘이 그 자리에 없다"고 보고 밝기 판정을 아예 쉰다.
   * 다른 창에 가려지거나 퀵슬롯이 잠깐 사라졌을 때 그걸 설치로 오인하지 않기 위한 장치.
   * 쿨타임 숫자가 겹쳐도 통과해야 하므로 느슨하게 잡는다.
   */
  matchThreshold: 0.45,
  /** 이 시간(ms) 이상 못 알아보면 화면에 알린다 */
  lostWarnMs: 1500,
  /**
   * 아이콘 주변을 함께 보는 범위 (아이콘 크기의 배수).
   * 맵을 이동하면 화면 전체가 잠깐 까매지는데, 이때 아이콘도 같이 어두워진다.
   * 모양은 그대로라 상호상관으로는 걸러지지 않는다(밝기에 불변이므로).
   * 그래서 "아이콘만 어두워졌는지"를 주변과 견줘서 판단한다.
   */
  contextScale: 3,
  /** 주변까지 이 정도로 어두워졌으면 화면 자체가 어두워진 것 — 판단을 쉰다 */
  contextBlackout: 0.5,
  /**
   * 쿨타임 숫자 판정.
   * 쿨타임이 도는 동안 아이콘은 어두워지지만 그 위에 밝은 숫자가 얹힌다.
   * 화면이 까매지거나 가려진 경우에는 그 밝은 점들이 없다 —
   * "어두워졌다"만으로는 구분이 안 되던 것을 이걸로 가른다.
   */
  glyphLevel: 0.7,     // 기준 밝기의 이 비율을 넘으면 "밝은 점"
  glyphMinRatio: 0.02, // 영역에서 밝은 점이 이 비율 이상이어야 숫자로 인정
  /**
   * 기준 밝기 갱신의 위쪽 한계(기준 대비).
   * 쿨타임이 끝날 때의 연출로 확 밝아진 값까지 섞이면 기준선이 올라가고,
   * 원래 밝기로 돌아왔을 때 "어두워졌다"고 잘못 판단하게 된다.
   * 아래쪽 한계는 brightRatio를 그대로 쓴다 — 살짝 떨어진 값은 이미 설치의 시작일 수 있다.
   */
  baselineAcceptHigh: 1.15,
}

/** 어두워진 아이콘 위에 남아 있는 밝은 점(쿨타임 숫자)의 비율 */
export function glyphRatio(data, level) {
  let bright = 0
  const n = data.length / 4
  for (let i = 0; i < n; i++) {
    const p = i * 4
    if (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2] > level) bright++
  }
  return n ? bright / n : 0
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
  /** 목록에 없는 값이면 첫 번째 소리로 대체된다 (alarm.js resolveSound) */
  sound: null,
  /**
   * 타이머 보정(초). 감지한 설치 시각을 이만큼 옮긴다.
   * 화면 공유 지연, 아이콘이 어두워지기까지의 시차처럼 환경마다 다른 요인이 있어
   * 인게임 지속시간과 견줘 직접 맞출 수 있게 열어둔다. 음수면 타이머가 그만큼 앞당겨진다.
   */
  trimSec: 0,
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

