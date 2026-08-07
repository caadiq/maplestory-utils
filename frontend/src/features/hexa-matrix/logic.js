/**
 * 헥사 코어 강화 비용 (KMS 현행, 누적표 — 인덱스 = 코어 레벨).
 *
 * cum[lv]는 0레벨에서 lv까지 올리는 데 든 총량. 남은 비용 = cum[30] - cum[현재].
 * 같은 타입이라도 몇 번째 코어인지에 따라 표가 다르다 —
 * 3번째 스킬 코어와 3번째 공용 코어는 나중에 추가되며 비용이 낮게 책정됐다.
 */
export const COST = {
  // 스킬 코어 1·2번째 (오리진 포함) — 총 150 / 4,500
  skill12: { erda: [0, 5, 6, 7, 8, 10, 12, 14, 17, 20, 30, 33, 36, 40, 44, 48, 52, 56, 60, 65, 80, 85, 90, 95, 100, 105, 111, 117, 123, 130, 150], frag: [0, 100, 130, 165, 205, 250, 300, 355, 415, 480, 680, 760, 850, 950, 1060, 1180, 1310, 1450, 1600, 1760, 2110, 2280, 2460, 2650, 2850, 3060, 3280, 3510, 3750, 4000, 4500] },
  // 스킬 코어 3번째 — 총 117 / 3,442
  skill3: { erda: [0, 7, 8, 9, 10, 11, 13, 15, 17, 19, 27, 29, 31, 34, 37, 40, 43, 46, 49, 52, 64, 68, 72, 76, 80, 84, 88, 93, 98, 103, 117], frag: [0, 140, 161, 187, 217, 251, 289, 332, 379, 430, 572, 634, 703, 780, 863, 954, 1052, 1157, 1269, 1389, 1641, 1769, 1905, 2050, 2202, 2363, 2531, 2708, 2892, 3085, 3442] },
  // 마스터리 코어 — 총 83 / 2,252
  mastery: { erda: [0, 3, 4, 5, 6, 7, 8, 9, 11, 13, 18, 20, 22, 24, 26, 28, 30, 32, 34, 37, 45, 48, 51, 54, 57, 60, 63, 66, 69, 73, 83], frag: [0, 50, 65, 83, 103, 126, 151, 179, 209, 242, 342, 382, 427, 477, 532, 592, 657, 727, 802, 882, 1057, 1142, 1232, 1327, 1427, 1532, 1642, 1757, 1877, 2002, 2252] },
  // 강화 코어 — 총 123 / 3,383
  enhance: { erda: [0, 4, 5, 6, 7, 9, 11, 13, 16, 19, 27, 30, 33, 36, 39, 42, 45, 48, 51, 55, 67, 71, 75, 79, 83, 87, 92, 97, 102, 108, 123], frag: [0, 75, 98, 125, 155, 189, 227, 269, 314, 363, 513, 573, 641, 716, 799, 889, 987, 1092, 1205, 1325, 1588, 1716, 1851, 1994, 2144, 2302, 2467, 2640, 2820, 3008, 3383] },
  // 공용 코어 1·2번째 (솔 야누스·솔 헤카테) — 총 208 / 6,268
  common12: { erda: [0, 7, 9, 11, 13, 16, 19, 22, 27, 32, 46, 51, 56, 62, 68, 74, 80, 86, 92, 99, 116, 123, 130, 137, 144, 151, 160, 169, 178, 188, 208], frag: [0, 125, 163, 207, 257, 314, 377, 446, 521, 603, 903, 1013, 1137, 1275, 1427, 1592, 1771, 1964, 2171, 2391, 2916, 3150, 3398, 3660, 3935, 4224, 4527, 4844, 5174, 5518, 6268] },
  // 공용 코어 3번째 (아르카나 오버라이드) — 총 137 / 4,035
  common3: { erda: [0, 4, 5, 6, 7, 9, 11, 13, 16, 19, 28, 31, 34, 37, 40, 44, 48, 52, 56, 60, 74, 78, 83, 88, 93, 98, 103, 108, 113, 119, 137], frag: [0, 90, 115, 145, 180, 220, 265, 315, 370, 430, 610, 683, 764, 854, 952, 1059, 1174, 1298, 1430, 1571, 1886, 2037, 2197, 2367, 2546, 2735, 2933, 3141, 3358, 3585, 4035] },
}

/** 타입 문자열 → 같은 타입 안에서 몇 번째인지에 따른 비용표 키 */
export function costKeyFor(type, indexInType) {
  if (type === '스킬 코어') return indexInType >= 2 ? 'skill3' : 'skill12'
  if (type === '마스터리 코어') return 'mastery'
  if (type === '강화 코어') return 'enhance'
  if (type === '공용 코어') return indexInType >= 2 ? 'common3' : 'common12'
  return 'mastery'
}

export const MAX_LEVEL = 30

/** 코어 목록에 비용 정보(남은/사용/총량)를 붙인다. 같은 타입 안의 순서로 표를 고른다 */
export function withCosts(cores) {
  const seen = {}
  return cores.map((c) => {
    const idx = seen[c.type] ?? 0
    seen[c.type] = idx + 1
    const t = COST[costKeyFor(c.type, idx)]
    const lv = Math.min(MAX_LEVEL, c.level)
    return {
      ...c,
      spentErda: t.erda[lv],
      spentFrag: t.frag[lv],
      remainErda: t.erda[MAX_LEVEL] - t.erda[lv],
      remainFrag: t.frag[MAX_LEVEL] - t.frag[lv],
      totalErda: t.erda[MAX_LEVEL],
      totalFrag: t.frag[MAX_LEVEL],
      // 진행률은 레벨이 아니라 재화 기준 — 후반 레벨이 훨씬 비싸다
      progress: (t.erda[lv] + t.frag[lv]) / (t.erda[MAX_LEVEL] + t.frag[MAX_LEVEL]),
    }
  })
}

/** 사냥에만 쓰는 스킬 — "솔 야누스 제외" 토글 대상 */
export function isHuntingCore(core) {
  return core.type === '공용 코어' && core.name.includes('솔 야누스')
}

/**
 * 에픽 던전 주간 보상 (사용자 제공 인게임 표 기준).
 *
 * 보너스 단계 표에 적힌 수치는 **그 자체가 총 수령량**이다 — 기본에 더하는 게 아니다.
 * (예: 악몽선경 1단계 "솔 에르다 10개" = 기본 2 + 추가 4배 8 = 총 10)
 * 그래서 관례상 1단계를 4배, 2단계를 8배라 부른다. 조각은 어느 단계든 15개다.
 * 앵글러 컴퍼니의 "짙은 솔 에르다의 기운"은 기운 500 충전 = 솔 에르다 0.5개로 환산
 * (솔 에르다 1개 = 기운 1000). 짙은 기운도 같은 배율로 지급된다.
 *
 * erda: [1배, 4배(1단계), 8배(2단계)] 주간 총량
 */
export const EPIC_DUNGEONS = [
  { id: 'none', name: '미진행', erda: [0, 0, 0], frag: 0 },
  { id: 'highmountain', name: '하이마운틴', erda: [1, 5, 9], frag: 15 },
  // 솔 에르다 [1, 5, 9] + 짙은 기운 [1, 5, 9] × 0.5
  { id: 'angler', name: '앵글러 컴퍼니', erda: [1.5, 7.5, 13.5], frag: 15 },
  { id: 'nightmare', name: '악몽선경', erda: [2, 10, 18], frag: 15 },
]
export const EPIC_MULTIPLIERS = [1, 4, 8]

export const STORAGE_KEY = 'maple.hexa.settings.v2'

export const DEFAULT_SETTINGS = {
  dungeon: 'highmountain',
  multiplier: 1,
  huntErdaPerDay: 0,     // 사냥으로 얻는 솔 에르다 (개/일)
  /*
   * 캐시샵·코인샵 등 기타 구매는 주간 반복이 아니라 "기간 한정 총 몇 개" 방식이라
   * 주간 수급이 아닌 일회성 획득으로 계산한다 — 남은 필요량에서 바로 차감.
   */
  etcErdaOnce: 0,
  fragPrice: 0,          // 조각 개당 평균 가격 (만 메소)
  buyMode: 'count',      // count | meso
  buyCountPerWeek: 0,    // 개/주
  buyMesoPerWeek: 0,     // 억/주
  huntFragPerDay: 0,     // 사냥으로 얻는 조각 (개/일)
  useBossRevenue: false, // 주간 보스 수익으로 조각 최대 구매
  excludeJanus: false,
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

export function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* 시크릿 모드 등 */ }
}

/** 주간 수급량 계산 */
export function weeklyIncome(s, bossRevenueMeso = 0) {
  const dungeon = EPIC_DUNGEONS.find((d) => d.id === s.dungeon) || EPIC_DUNGEONS[0]
  const step = EPIC_MULTIPLIERS.indexOf(s.multiplier)
  const stepIdx = step >= 0 ? step : 0
  const erda = dungeon.erda[stepIdx] + s.huntErdaPerDay * 7

  // 구매: 개수 직접 입력 또는 주간 예산(억) ÷ 개당가(만 메소)
  // (억 = 10000만 이므로 예산(억)×10000 ÷ 개당가(만) = 개수)
  const buyCount = s.buyMode === 'count'
    ? s.buyCountPerWeek
    : s.fragPrice > 0 ? Math.floor((s.buyMesoPerWeek * 10000) / s.fragPrice) : 0

  // 주간 보스 수익(메소)으로 최대 구매
  const bossCount = s.useBossRevenue && s.fragPrice > 0
    ? Math.floor(bossRevenueMeso / (s.fragPrice * 10000))
    : 0

  const frag = dungeon.frag + s.huntFragPerDay * 7 + buyCount + bossCount
  const buyMesoWeekly = (buyCount + bossCount) * s.fragPrice * 10000 // 메소

  return { erda, frag, buyCount, bossCount, buyMesoWeekly }
}

/** 남은 재화 ÷ 주간 수급 → 소요 주. 수급이 0이면 Infinity */
export function weeksFor(remain, perWeek) {
  if (remain <= 0) return 0
  if (perWeek <= 0) return Infinity
  return remain / perWeek
}

export function fmtWeeks(w) {
  if (w === 0) return '완료'
  if (!Number.isFinite(w)) return '—'
  return `${w < 10 ? w.toFixed(1) : Math.ceil(w)}주`
}

export function fmtNum(n) {
  // 앵글러 컴퍼니의 짙은 기운 환산으로 소수(0.5)가 나올 수 있다
  return Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

/**
 * 완료 예상일 — 주간 리셋(목요일) 기준.
 *
 * 주간 수급(에픽던전·보스 수익)은 목요일에 초기화되므로 "몇 번의 주간 사이클이
 * 필요한가"로 센다. 오늘이 속한 사이클(직전 목요일~수요일)이 1주차이고,
 * 완료일은 마지막 사이클이 끝나는 수요일이다.
 */
export function dateAfterWeeks(w) {
  if (!Number.isFinite(w)) return null
  const cycles = Math.max(1, Math.ceil(w))
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  const sinceThursday = (d.getDay() - 4 + 7) % 7 // 직전 목요일로부터 지난 일수
  d.setDate(d.getDate() - sinceThursday + cycles * 7 - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 메소 표기: 억 단위 축약 */
export function fmtMeso(meso) {
  if (meso >= 1_0000_0000) {
    const eok = meso / 1_0000_0000
    return `${eok >= 100 ? Math.round(eok) : eok.toFixed(1)}억`
  }
  return `${Math.round(meso / 10000).toLocaleString('ko-KR')}만`
}
