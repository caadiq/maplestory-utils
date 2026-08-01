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
   * 확정이 늦어져도 시각은 "처음 어두워지기 시작한 순간"으로 소급하므로 타이머 정확도는 그대로다.
   * 어두워짐 쪽을 짧게 잡은 이유는 정확도가 아니라 반응 속도다 — 화면에 타이머가 뜨는 게 늦어 보인다.
   */
  confirmDarkMs: 600,
  confirmBrightMs: 1500,
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
   * 기준 밝기 갱신의 위쪽 한계(기준 대비).
   * 쿨타임이 끝날 때의 연출로 확 밝아진 값까지 섞이면 기준선이 올라가고,
   * 원래 밝기로 돌아왔을 때 "어두워졌다"고 잘못 판단하게 된다.
   * 아래쪽 한계는 brightRatio를 그대로 쓴다 — 살짝 떨어진 값은 이미 설치의 시작일 수 있다.
   */
  baselineAcceptHigh: 1.15,
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

/* ── 자동 탐색 ────────────────────────────────────────────── */

/** 저장해둔 모양을 화면 전체에서 찾을 때 쓰는 값들 */
export const LOCATE = {
  /**
   * 1단계로 훑을 때 줄이는 화면 가로 크기.
   * 여기서는 자리만 대충 찾고, 진짜 판정은 원본 해상도에서 다시 한다.
   * (줄인 화면에서는 아이콘이 15px 남짓이라 세부가 뭉개져 그것만으로는 못 믿는다)
   */
  frameWidth: 640,
  /** 1단계 통과선 — 놓치는 것보다 후보가 조금 많은 편이 낫다 */
  coarseScore: 0.4,
  /**
   * 자동으로 고르는 조건. 절대 점수만으로는 판단이 안 된다 —
   * 화면에는 보라색 아이콘이 여럿이라 엉뚱한 곳도 0.7~0.8이 나온다.
   * 1등이 충분히 높고 2등과 뚜렷이 벌어졌을 때만 확신한다.
   * (실측: 저장된 모양이면 정답 0.99 / 2등 0.73, 내장 원본이면 0.87 / 0.76)
   */
  sureScore: 0.82,
  sureMargin: 0.12,
  /** 후보로 보여줄 최소 점수 */
  minScore: 0.6,
  /** 여기까지는 후보로 보여준다 */
  looseScore: 0.42,
  /** 2단계에서 후보 주변을 살펴볼 반경(px) */
  refineRadius: 8,
  /** 이 거리(px, 축소 화면 기준) 안의 후보는 같은 것으로 본다 */
  mergeDistance: 12,
  /** 최대 후보 수 */
  maxCandidates: 6,
  /** 1단계에서 2단계로 넘길 후보 수 */
  coarseKeep: 12,
  /**
   * 내장 원본으로 찾을 때 훑어볼 아이콘 크기(원본 화면 기준 px).
   * 화면 배율·해상도에 따라 실제 크기가 달라져서 몇 가지를 시도한다.
   */
  builtinSizes: [22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 48],
  /**
   * 1단계로 훑을 대표 크기들. 크기가 20%쯤 달라도 걸리므로 셋이면 22~48px을 덮는다.
   * (하나만 쓰면 화면 배율이 큰 환경에서 아예 후보가 안 잡힌다)
   */
  coarseSizes: [26, 36, 46],
}

/**
 * 축소한 화면 전체를 훑어 저장해둔 모양과 닮은 자리를 찾는다.
 * 창을 고를 때마다 아이콘을 다시 집는 수고를 없애기 위한 것.
 *
 * gray: 축소 화면의 밝기 배열(w*h), tpl: 정규화된 템플릿(tw*th)
 */
export function findMatches(gray, w, h, tpl, tw, th, opts = {}) {
  const { step = 2, minScore = LOCATE.minScore, bounds = null, merge = true } = opts
  const x0 = Math.max(0, bounds?.x0 ?? 0)
  const y0 = Math.max(0, bounds?.y0 ?? 0)
  const x1 = Math.min(w - tw, bounds?.x1 ?? w - tw)
  const y1 = Math.min(h - th, bounds?.y1 ?? h - th)

  const found = []
  const n = tw * th
  const invN = 1 / n
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      let sum = 0
      let sqSum = 0
      for (let j = 0; j < th; j++) {
        const row = (y + j) * w + x
        for (let i = 0; i < tw; i++) {
          const v = gray[row + i]
          sum += v
          sqSum += v * v
        }
      }
      const mean = sum * invN
      const variance = sqSum * invN - mean * mean
      if (variance < 4) continue // 거의 단색 — 아이콘일 리 없다 (색 성분은 값 범위가 좁아 기준도 낮다)
      const inv = 1 / (Math.sqrt(variance) * Math.sqrt(n))

      let dot = 0
      for (let j = 0; j < th; j++) {
        const row = (y + j) * w + x
        const trow = j * tw
        for (let i = 0; i < tw; i++) dot += (gray[row + i] - mean) * tpl[trow + i]
      }
      const score = dot * inv
      if (score >= minScore) found.push({ x, y, score })
    }
  }

  found.sort((a, b) => b.score - a.score)
  if (!merge) return found

  // 가까이 붙은 후보는 같은 아이콘이므로 가장 점수 높은 것만 남긴다
  const merged = []
  for (const c of found) {
    if (merged.some((m) => Math.abs(m.x - c.x) < LOCATE.mergeDistance && Math.abs(m.y - c.y) < LOCATE.mergeDistance)) continue
    merged.push(c)
  }
  return merged
}

/* ── 템플릿 저장 ──────────────────────────────────────────── */

const TEMPLATE_KEY = 'maple.janus.template'

/** { rgba, tw, th, rw, rh } — 지정한 순간의 아이콘 픽셀과 영역 비율 */
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

