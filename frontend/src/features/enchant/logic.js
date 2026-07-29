// 장비 강화 기록 공용 로직 (PC·모바일 공유)
import { starforceCost, cubeFee, potentialResetCost, guaranteeCeiling } from './costs'

/** KST 기준 오늘 YYYY-MM-DD */
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

export function daysAgoKST(n) {
  return new Date(Date.now() + 9 * 3600 * 1000 - n * 86400 * 1000).toISOString().slice(0, 10)
}

export function formatKoreanMeso(n) {
  if (n == null) return '-'
  if (n === 0) return '0'
  const uk = Math.floor(n / 100000000)
  const man = Math.floor((n % 100000000) / 10000)
  const rest = n % 10000
  const parts = []
  if (uk > 0) parts.push(`${uk.toLocaleString()}억`)
  if (man > 0) parts.push(`${man.toLocaleString()}만`)
  if (rest > 0 || parts.length === 0) parts.push(rest.toLocaleString())
  return parts.join(' ')
}

/** 억·만 단위까지만 (1의 자리 생략) — 요약 카드처럼 폭이 좁은 곳용 */
export function formatMesoShort(n) {
  if (n == null) return '-'
  if (n === 0) return '0'
  const uk = Math.floor(n / 100000000)
  const man = Math.floor((n % 100000000) / 10000)
  const parts = []
  if (uk > 0) parts.push(`${uk.toLocaleString()}억`)
  if (man > 0) parts.push(`${man.toLocaleString()}만`)
  if (parts.length === 0) parts.push(n.toLocaleString())
  return parts.join(' ')
}

/** 축약값과 전체값이 다른지 (툴팁을 띄울지 판단) */
export function isMesoTruncated(n) {
  return n != null && n >= 10000 && n % 10000 !== 0
}

/** 시간 "MM-DD HH:mm" */
export function formatTime(iso) {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

/** 통계에서 빼는 아이템 — 이벤트 튜토리얼 전용이라 실제 강화 기록으로 볼 수 없다 */
export const EXCLUDED_ITEMS = new Set([
  '슈피겔만의 평범한 목걸이',   // 테라 블링크 튜토리얼에서 강화 후 사라짐
])

export function isExcludedItem(name) {
  return EXCLUDED_ITEMS.has(name)
}

// ─────────────────── 스타포스 ───────────────────

/** "파괴 방지 적용"/"파괴 방지 미적용" 류 플래그 판정 — 미적용·미해당이면 false */
export function flagApplied(v) {
  if (!v) return false
  if (v.includes('미적용') || v.includes('미해당') || v.includes('않음')) return false
  return v.includes('적용') || v.includes('해당') || v.includes('사용')
}

/** 스타포스 결과 분류: success | fail | destroy */
export function sfResult(item) {
  const r = item.item_upgrade_result || ''
  if (r.includes('성공')) return 'success'
  if (r.includes('파괴')) return 'destroy'
  return 'fail'
}

/** 실패 중에서도 별이 실제로 내려간 경우 (실패(하락)) */
export function isDrop(item) {
  return (item.item_upgrade_result || '').includes('하락')
}

/**
 * 이벤트 할인·파괴방지 반영 1회 비용
 * { base, final, discounted, reasons[] } — 계산 불가 시 null
 * base는 아무 보정 없는 정가, reasons는 정가와 달라진 사유 목록
 */
export function sfCost(item) {
  const superior = flagApplied(item.superior_item_flag)
  const base = starforceCost(item.target_item, item.before_starforce_count, superior)
  if (base == null) return null

  const reasons = []
  // 강화권으로 올린 단계는 메소를 쓰지 않는다
  if (item.upgrade_item) {
    return { base, final: 0, discounted: true, reasons: [{ label: item.upgrade_item, effect: '메소 소모 없음' }] }
  }
  if (superior) reasons.push({ label: '슈페리얼 장비', effect: '전용 비용표' })

  let rate = 0
  for (const ev of item.starforce_event_list || []) {
    const d = Number(ev.cost_discount_rate)
    if (!isNaN(d) && d > 0) rate = Math.max(rate, d)
  }
  const discountedCost = rate > 0 ? Math.floor((base * (100 - rate)) / 100 / 10) * 10 : base
  if (rate > 0) reasons.push({ label: '스타포스 할인 이벤트', effect: `-${rate}%` })

  // 파괴방지(15~17성): 기본 비용의 +200% 추가 — 추가분에는 할인 미적용
  const star = item.before_starforce_count
  const defence = flagApplied(item.destroy_defence) && star >= 15 && star <= 17
  if (defence) reasons.push({ label: '파괴 방지', effect: '+200%' })

  return {
    base,
    final: defence ? discountedCost + base * 2 : discountedCost,
    discounted: rate > 0,
    reasons,
  }
}

/** 스타포스 이력 → 아이템(캐릭터+장비) 그룹 목록 */
export function groupStarforce(items) {
  const map = new Map()
  for (const it of items) {
    const key = `${it.character_name}::${it.target_item}`
    if (!map.has(key)) {
      map.set(key, { key, character: it.character_name, item: it.target_item, world: it.world_name, records: [] })
    }
    map.get(key).records.push(it)
  }
  const groups = [...map.values()]
  for (const g of groups) {
    // records는 최신순(응답 정렬 유지) — 통계 계산
    const recs = g.records
    const oldest = recs[recs.length - 1]
    const newest = recs[0]
    g.startStar = oldest.before_starforce_count
    g.destroyed = sfResult(newest) === 'destroy'
    g.endStar = g.destroyed ? null : newest.after_starforce_count
    g.tries = recs.length
    g.success = recs.filter((r) => sfResult(r) === 'success').length
    g.destroyCount = recs.filter((r) => sfResult(r) === 'destroy').length
    g.dropCount = recs.filter((r) => isDrop(r)).length
    g.defenceCount = recs.filter((r) => flagApplied(r.destroy_defence)).length
    // 최고성 도전 기록
    const maxTarget = Math.max(...recs.map((r) => r.before_starforce_count)) + 1
    const topTries = recs.filter((r) => r.before_starforce_count === maxTarget - 1)
    g.topTarget = maxTarget
    g.topSuccess = topTries.filter((r) => sfResult(r) === 'success').length
    g.topFail = topTries.length - g.topSuccess
    // 연속 실패 스트릭 (같은 성에서)
    let bestStreak = 0
    let bestStreakStar = null
    let cur = 0
    let curStar = null
    for (let i = recs.length - 1; i >= 0; i--) {
      const r = recs[i]
      if (sfResult(r) !== 'success') {
        if (curStar === r.before_starforce_count) cur += 1
        else { cur = 1; curStar = r.before_starforce_count }
        if (cur > bestStreak) { bestStreak = cur; bestStreakStar = curStar }
      } else {
        cur = 0
        curStar = null
      }
    }
    g.failStreak = bestStreak >= 3 ? { star: bestStreakStar, count: bestStreak } : null
    // 비용 합산
    let total = 0
    let known = true
    for (const r of recs) {
      const c = sfCost(r)
      if (c == null) { known = false; continue }
      total += c.final
    }
    g.totalCost = known || total > 0 ? total : null
    g.costPartial = !known
  }
  return groups.sort((a, b) => b.tries - a.tries)
}

/**
 * 구간별 성공률 — n성 → n+1성 시도별 집계 (시도 많은 순)
 * @returns [{ star, tries, success, destroy, rate }]
 */
export function starRangeStats(records) {
  const map = new Map()
  for (const r of records) {
    const star = r.before_starforce_count
    if (star == null) continue
    if (!map.has(star)) map.set(star, { star, tries: 0, success: 0, destroy: 0 })
    const s = map.get(star)
    s.tries += 1
    const res = sfResult(r)
    if (res === 'success') s.success += 1
    else if (res === 'destroy') s.destroy += 1
  }
  return [...map.values()]
    .map((s) => ({ ...s, rate: s.tries > 0 ? (s.success / s.tries) * 100 : 0 }))
    .sort((a, b) => b.tries - a.tries || b.star - a.star)
}

/** 스타포스 전체 요약 */
export function starforceSummary(items) {
  const s = { tries: items.length, success: 0, fail: 0, destroy: 0, drop: 0, defence: 0, cost: 0 }
  for (const it of items) {
    const r = sfResult(it)
    if (r === 'success') s.success += 1
    else if (r === 'destroy') s.destroy += 1
    else s.fail += 1
    if (isDrop(it)) s.drop += 1
    if (flagApplied(it.destroy_defence)) s.defence += 1
    const c = sfCost(it)
    if (c) s.cost += c.final
  }
  return s
}

// ─────────────────── 잠재능력 (큐브 + 메소 재설정 통합) ───────────────────

/** 큐브 이름으로 에디셔널 여부 판별 */
export function isAdditionalCube(cubeType) {
  return (cubeType || '').includes('에디셔널')
}

/** 통합 레코드 정규화: cube_history + potential_history → 공통 형태 */
export function normalizePotential(cubeItems, potentialItems) {
  const rows = []
  for (const it of cubeItems) {
    rows.push({
      ...it,
      method: 'cube',
      methodName: it.cube_type,
      kind: isAdditionalCube(it.cube_type) ? 'additional' : 'potential',
    })
  }
  for (const it of potentialItems) {
    rows.push({
      ...it,
      method: 'meso',
      methodName: '메소 재설정',
      kind: (it.potential_type || '').includes('에디셔널') ? 'additional' : 'potential',
    })
  }
  rows.sort((a, b) => (a.date_create < b.date_create ? 1 : -1))
  return rows
}

/** 재설정 1회 비용 (계산 불가 시 null) */
export function potentialCost(row) {
  if (row.method === 'meso') {
    const grade = row.kind === 'additional' ? row.additional_potential_option_grade : row.potential_option_grade
    return potentialResetCost(row.kind, grade, row.item_level)
  }
  return cubeFee(row.cube_type, row.item_level)
}

/** 등급업 여부 */
export function isGradeUp(row) {
  return (row.item_upgrade_result || '').includes('등급 상승') || (row.item_upgrade_result || '').includes('성공')
}

/** 잠재 이력 → 아이템 그룹 */
export function groupPotential(rows) {
  const map = new Map()
  for (const it of rows) {
    const key = `${it.character_name}::${it.target_item}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        character: it.character_name,
        item: it.target_item,
        part: it.item_equipment_part,
        level: it.item_level,
        records: [],
      })
    }
    map.get(key).records.push(it)
  }
  const groups = [...map.values()]
  for (const g of groups) {
    const recs = g.records
    g.tries = recs.length
    g.cubeTries = recs.filter((r) => r.method === 'cube').length
    g.mesoTries = recs.filter((r) => r.method === 'meso').length
    g.gradeUps = recs.filter(isGradeUp).length

    // 잠재/에디 각각 등급 변화 (오래된 것 → 최신)
    for (const kind of ['potential', 'additional']) {
      const ofKind = recs.filter((r) => r.kind === kind)
      if (ofKind.length === 0) {
        g[kind] = null
        continue
      }
      const oldest = ofKind[ofKind.length - 1]
      const newest = ofKind[0]
      const gradeKey = kind === 'additional' ? 'additional_potential_option_grade' : 'potential_option_grade'
      g[kind] = {
        from: oldest[gradeKey],
        to: newest[gradeKey],
        upgraded: recs.some((r) => r.kind === kind && isGradeUp(r)),
        stack: newest.upgrade_guarantee_count,
        ceiling: guaranteeCeiling(newest.methodName, kind, newest[gradeKey]),
      }
    }

    // 수단별 사용 횟수 (아이콘 표시용) — 메소 재설정은 잠재/에디 구분
    const counts = new Map()
    for (const r of recs) {
      const iconName = r.method === 'cube'
        ? r.cube_type
        : (r.kind === 'additional' ? '에디셔널 잠재능력 재설정' : '잠재능력 재설정')
      counts.set(iconName, (counts.get(iconName) || 0) + 1)
    }
    g.methods = [...counts.entries()]
      .map(([iconName, count]) => ({ iconName, count }))
      .sort((a, b) => b.count - a.count)

    // 비용: 메소 재설정 비용 + 큐브 감정비 분리
    let resetCost = 0
    let feeCost = 0
    let known = true
    for (const r of recs) {
      const c = potentialCost(r)
      if (c == null) { known = false; continue }
      if (r.method === 'meso') resetCost += c
      else feeCost += c
    }
    g.resetCost = resetCost
    g.feeCost = feeCost
    g.totalCost = known || resetCost + feeCost > 0 ? resetCost + feeCost : null
    g.costPartial = !known
  }
  return groups.sort((a, b) => b.tries - a.tries)
}

/** 잠재 전체 요약 */
export function potentialSummary(rows) {
  const s = { tries: rows.length, cube: 0, meso: 0, gradeUps: 0, miracle: 0, cost: 0, resetCost: 0, feeCost: 0 }
  for (const r of rows) {
    if (r.method === 'cube') s.cube += 1
    else s.meso += 1
    if (isGradeUp(r)) s.gradeUps += 1
    if (flagApplied(r.miracle_time_flag)) s.miracle += 1
    const c = potentialCost(r)
    if (c) {
      s.cost += c
      if (r.method === 'meso') s.resetCost += c
      else s.feeCost += c
    }
  }
  return s
}

/** 행별 천장 (해당 시도 시점의 수단·등급 기준) */
export function rowCeiling(row) {
  const grade = row.kind === 'additional' ? row.additional_potential_option_grade : row.potential_option_grade
  return guaranteeCeiling(row.methodName, row.kind, grade)
}

/** 등급 순서 — 등급업 시 이전 등급 유추용 */
export const GRADE_ORDER = ['레어', '에픽', '유니크', '레전드리']

/** 등급업 행의 등급 변화 { from, to } (등급업이 아니면 null) */
export function gradeUpPair(row) {
  if (!isGradeUp(row)) return null
  const to = row.kind === 'additional' ? row.additional_potential_option_grade : row.potential_option_grade
  const idx = GRADE_ORDER.indexOf(to)
  return { from: idx > 0 ? GRADE_ORDER[idx - 1] : null, to }
}

/** "4월 23일 (목)" / "00:52" 두 줄 표기용 */
const DOW = ['일', '월', '화', '수', '목', '금', '토']
export function formatDateParts(iso) {
  const d = new Date(iso)
  // 해가 넘어간 기록은 연도까지 (전체 기간 조회라 2년 치가 섞인다)
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : ''
  return {
    date: `${year}${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`,
    time: `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}시 ${d.getMinutes()}분`,
  }
}

/** 등급 텍스트 색 */
export const GRADE_COLOR = {
  '레어': '#1e93aa',
  '에픽': '#9247c9',
  '유니크': '#b3861a',
  '레전드리': '#4e9e20',
}

/** 변경 전 옵션용 연한 등급색 */
export const GRADE_COLOR_SOFT = {
  '레어': '#84c2ce',
  '에픽': '#c4a2de',
  '유니크': '#dcc48d',
  '레전드리': '#a2cc90',
}


// ─────────────────── 통계 (츄츄지지 스타일) ───────────────────

/** 잠재 상세 통계 — 등급별 재설정 횟수 · 등급업 확률 · 수단별 사용량 */
export function potentialStats(rows) {
  const kinds = ['potential', 'additional']
  const grades = ['레어', '에픽', '유니크', '레전드리']

  // 등급별 재설정 횟수
  const resetByGrade = {
    potential: Object.fromEntries(grades.map((g) => [g, 0])),
    additional: Object.fromEntries(grades.map((g) => [g, 0])),
  }
  // 등급업 시도/성공 (해당 등급에서 시도한 횟수 = 그 등급 상태로 재설정한 횟수)
  const upgrade = {
    potential: Object.fromEntries(grades.slice(0, 3).map((g) => [g, { tries: 0, success: 0 }])),
    additional: Object.fromEntries(grades.slice(0, 3).map((g) => [g, { tries: 0, success: 0 }])),
  }
  // 수단별 사용량
  const methodCounts = new Map()
  let resetCost = 0
  let feeCost = 0
  let miracle = 0
  const countByKind = { potential: 0, additional: 0 }

  for (const r of rows) {
    const kind = r.kind === 'additional' ? 'additional' : 'potential'
    countByKind[kind] += 1
    const grade = kind === 'additional' ? r.additional_potential_option_grade : r.potential_option_grade
    if (grade && resetByGrade[kind][grade] != null) resetByGrade[kind][grade] += 1

    const up = gradeUpPair(r)
    if (up?.from && upgrade[kind][up.from]) {
      upgrade[kind][up.from].success += 1
    }
    // 시도: 현재 등급이 최고 등급이 아니면 등급업 시도로 집계
    if (grade && upgrade[kind][grade]) upgrade[kind][grade].tries += 1

    const iconName = r.method === 'cube'
      ? r.cube_type
      : (kind === 'additional' ? '에디셔널 잠재능력 재설정' : '잠재능력 재설정')
    methodCounts.set(iconName, (methodCounts.get(iconName) || 0) + 1)

    const c = potentialCost(r)
    if (c) {
      if (r.method === 'meso') resetCost += c
      else feeCost += c
    }
    if (flagApplied(r.miracle_time_flag)) miracle += 1
  }

  // 천장으로 오른 건 확률 계산에서 빼기 (츄츄지지도 천장·미라클 제외)
  const upgradeRates = {}
  for (const kind of kinds) {
    upgradeRates[kind] = grades.slice(0, 3).map((g, i) => {
      const { tries, success } = upgrade[kind][g]
      return {
        from: g,
        to: grades[i + 1],
        tries,
        success,
        rate: tries > 0 ? (success / tries) * 100 : 0,
      }
    })
  }

  return {
    total: rows.length,
    countByKind,
    resetCost,
    feeCost,
    totalCost: resetCost + feeCost,
    miracle,
    resetByGrade,
    upgradeRates,
    methods: [...methodCounts.entries()]
      .map(([iconName, count]) => ({ iconName, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/** 스타포스 전체 통계 — 결과 분포 + 구간별 성공률 */
export function starforceStats(items) {
  const s = starforceSummary(items)
  return { ...s, ranges: starRangeStats(items) }
}

/** 정렬 옵션 */
export const SORT_OPTIONS = [
  { value: 'cost', label: '사용한 메소 순' },
  { value: 'tries', label: '재설정 횟수 순' },
  { value: 'recent', label: '최근 강화 순' },
  { value: 'name', label: '장비 이름순' },
]

export function sortGroups(groups, sort) {
  const arr = [...groups]
  switch (sort) {
    case 'tries': return arr.sort((a, b) => b.tries - a.tries)
    case 'recent': return arr.sort((a, b) => (a.records[0]?.date_create < b.records[0]?.date_create ? 1 : -1))
    case 'name': return arr.sort((a, b) => a.item.localeCompare(b.item, 'ko'))
    case 'cost':
    default: return arr.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
  }
}
