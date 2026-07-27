// 강화 비용·천장 데이터 (2026-07 기준)
// 출처: 나무위키 스타포스 강화/잠재능력/큐브 문서 + 공식 확률 가이드
//  - 스타포스: 신 스타포스(2024-12 개편 + 2025-03 30성 확장) 비용 공식
//  - 재설정 비용: 2024년 잠재/에디 메소 재설정 도입 현행가
//  - 천장: 2023-04 등급 상승 보장(기댓값×1.5), 공식 확률 페이지와 교차 검증

/** 장비 이름 접두사/이름 → 착용 레벨 (스타포스 비용 계산용) */
export const ITEM_LEVELS = {
  '네크로': 120,
  '시그너스 여제': 140,
  '펜살리르': 140,
  '루타비스': 150,
  '하이네스': 150,
  '이글아이': 150,
  '트릭스터': 150,
  '파프니르': 150,
  '앱솔랩스': 160,
  '아케인셰이드': 200,
  '에테르넬': 250,
  '제네시스': 200,
  '데스티니': 250,
  '타일런트': 150,
  '노바': 110,
  '마이스터': 140,
  // 여명의 보스 세트
  '트와일라이트 마크': 140,
  '에스텔라 이어링': 160,
  '여명의 가디언 엔젤 링': 160,
  '가디언 엔젤 링': 160,
  '데이브레이크 펜던트': 140,
  // 칠흑의 보스 세트
  '루즈 컨트롤 머신 마크': 160,
  '마력이 깃든 안대': 160,
  '블랙 하트': 120,
  '컴플리트 언더컨트롤': 200,
  '몽환의 벨트': 200,
  '고통의 근원': 160,
  '창세의 뱃지': 200,
  '커맨더 포스 이어링': 200,
  '거대한 공포': 200,
  '저주받은 마도서': 160,
  '미트라의 분노': 200,
  // 광휘의 보스 세트
  '근원의 속삭임': 250,
  '죽음의 맹세': 250,
  '불멸의 유산': 250,
  '황홀한 악몽': 250,
  '오만의 원죄': 250,
  '굶주리는 핏빛 원혼': 250,
  // 보스 장신구 세트
  '아쿠아틱 레터 눈장식': 100,
  '블랙빈 마크': 135,
  '파풀라투스 마크': 145,
  '응축된 힘의 결정석': 110,
  '골든 클로버 벨트': 140,
  '분노한 자쿰의 벨트': 150,
  '혼테일의 목걸이': 120,
  '카오스 혼테일의 목걸이': 120,
  '매커네이터 펜던트': 120,
  '도미네이터 펜던트': 140,
  '데아 시두스 이어링': 130,
  '지옥의 불꽃': 130,
  '실버블라썸 링': 110,
  '고귀한 이피아의 반지': 120,
  '크리스탈 웬투스 뱃지': 130,
  '로얄 블랙메탈 숄더': 120,
  '핑크빛 성배': 140,
}

// 긴 이름 우선 매칭 (예: '카오스 혼테일의 목걸이' > '혼테일의 목걸이')
const LEVEL_KEYS = Object.keys(ITEM_LEVELS).sort((a, b) => b.length - a.length)

export function itemLevel(itemName) {
  const name = itemName || ''
  for (const key of LEVEL_KEYS) {
    if (name.includes(key)) return ITEM_LEVELS[key]
  }
  return null
}

// ─────────────── 스타포스 비용 ───────────────
// 0~9성: 1000 + L³×(S+1)/36
// 10성~: 1000 + L³×(S+1)^2.7 / divisor(S), 100메소 단위 반올림
const STARFORCE_DIVISOR = {
  10: 571, 11: 314, 12: 214, 13: 157, 14: 107,
  15: 200, 16: 200, 17: 150, 18: 70, 19: 45,
  20: 200, 21: 125,
  22: 200, 23: 200, 24: 200, 25: 200, 26: 200, 27: 200, 28: 200, 29: 200,
}

// 슈페리얼 장비: 전 구간 고정 비용 (레벨별)
const SUPERIOR_COST = { 150: 55382200, 110: 18507900, 80: 5956000 }

/**
 * 스타포스 1회 기본 비용 (할인·파괴방지 미적용) — 계산 불가 시 null
 * @param {string} itemName 장비명
 * @param {number} star 현재 성 (star → star+1 시도)
 * @param {boolean} superior 슈페리얼 장비 여부
 */
export function starforceCost(itemName, star, superior = false) {
  const lv = itemLevel(itemName)
  if (lv == null || star == null || star < 0 || star > 29) return null
  if (superior) return SUPERIOR_COST[lv] ?? null
  const L3 = Math.pow(lv, 3)
  const raw = star <= 9
    ? 1000 + (L3 * (star + 1)) / 36
    : 1000 + (L3 * Math.pow(star + 1, 2.7)) / STARFORCE_DIVISOR[star]
  return Math.round(raw / 100) * 100
}

// ─────────────── 잠재 재설정(메소) 비용 ───────────────
const RESET_COST = {
  potential: [
    { min: 250, rare: 5000000, epic: 20000000, unique: 42500000, legendary: 50000000 },
    { min: 200, rare: 4500000, epic: 18000000, unique: 38250000, legendary: 45000000 },
    { min: 160, rare: 4250000, epic: 17000000, unique: 36125000, legendary: 42500000 },
    { min: 0, rare: 4000000, epic: 16000000, unique: 34000000, legendary: 40000000 },
  ],
  additional: [
    { min: 250, rare: 12250000, epic: 34300000, unique: 83300000, legendary: 98000000 },
    { min: 200, rare: 11000000, epic: 30800000, unique: 74800000, legendary: 88000000 },
    { min: 160, rare: 10375000, epic: 29050000, unique: 70550000, legendary: 83000000 },
    { min: 0, rare: 9750000, epic: 27300000, unique: 66300000, legendary: 78000000 },
  ],
}

const GRADE_KEY = { '레어': 'rare', '에픽': 'epic', '유니크': 'unique', '레전드리': 'legendary' }

/** 메소 잠재 재설정 1회 비용 (kind: potential|additional) — 미상이면 null */
export function potentialResetCost(kind, grade, level) {
  const table = RESET_COST[kind]
  const gk = GRADE_KEY[grade]
  if (!table || !gk || level == null) return null
  const row = table.find((r) => level >= r.min)
  return row ? row[gk] : null
}

// ─────────────── 큐브 사용 수수료(감정비) ───────────────
/** 큐브류 아이템 사용 시 감정비 — 장비 레벨 기준, 등급 무관 */
export function cubeFee(_cubeType, level) {
  if (level == null) return null
  if (level <= 30) return 0
  if (level <= 70) return 0.5 * level * level
  if (level <= 120) return 2.5 * level * level
  return 20 * level * level
}

// ─────────────── 등급업 천장 (등급 상승 보장) ───────────────
const CEILING = {
  potentialReset: { '레어': 10, '에픽': 42, '유니크': 107 },
  additionalReset: { '레어': 62, '에픽': 152, '유니크': 214 },
  blackCube: { '레어': 10, '에픽': 42, '유니크': 107 },
  whiteAdditionalCube: { '레어': 31, '에픽': 76, '유니크': 214 },
  redCube: { '레어': 25, '에픽': 83, '유니크': 500 },
  additionalCube: { '레어': 31, '에픽': 76, '유니크': 214 },
}

/** 수단명(cube_type 또는 '메소 재설정') → 천장 테이블 키. 천장 없는 수단은 null */
function ceilingKind(methodName, kind) {
  const n = methodName || ''
  if (n === '메소 재설정' || n.includes('잠재능력 재설정')) {
    return kind === 'additional' ? 'additionalReset' : 'potentialReset'
  }
  if (n.includes('블랙 큐브')) return 'blackCube'
  if (n.includes('화이트 에디셔널')) return 'whiteAdditionalCube'
  if (n.includes('레드 큐브')) return 'redCube'
  // 수상한/브론즈 에디셔널은 천장 없음 (에디셔널 큐브보다 먼저 검사)
  if (n.includes('수상한') || n.includes('브론즈')) return null
  if (n.includes('에디셔널 큐브')) return 'additionalCube'
  // 수상한/장인의/실버/명장의/골드 등: 천장 없음
  return null
}

/**
 * 등급업 천장 횟수 — 해당 수단·현재 등급에서 확정 등급업까지 필요한 스택.
 * 천장 미지원 수단이거나 미상이면 null
 */
export function guaranteeCeiling(methodName, kind, grade) {
  const ck = ceilingKind(methodName, kind)
  if (!ck) return null
  return CEILING[ck][grade] ?? null
}
