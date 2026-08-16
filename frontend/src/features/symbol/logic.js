import { computeCompletion, eventBonusForType } from './utils'

/**
 * 심볼 하나의 모든 파생 계산 (SymbolCard 표시 + 전체 요약 공용).
 * @param {object} p
 * @param {object} p.symbol    심볼 마스터데이터 (levels, max_level, daily_default, weekly_default, type)
 * @param {object} [p.progress] 해당 캐릭터의 이 심볼 진행도 (level, growth, daily, weeklyCount, extra, dailyDone, equipped)
 * @param {boolean} p.equipped 장착 여부
 * @param {object} [p.eventSkill] 캐릭터 이벤트 스킬(보약) 정보
 * @param {object} [p.artifact]  에테리온 아티팩트 일퀘 보너스 ({ arcane_daily, authentic_daily })
 */
export function symbolMetrics({ symbol, progress, equipped, eventSkill, artifact }) {
  const dailyDone = progress?.dailyDone ?? false
  const weeklyCount = progress?.weeklyCount ?? 3
  const baseDefault = symbol.daily_default ?? 0
  const eventBonus = eventBonusForType(eventSkill, symbol.type)
  const artifactBonus = eventBonusForType(artifact, symbol.type)
  const hasDailyOverride = progress?.daily !== undefined
  const daily = hasDailyOverride ? progress.daily : baseDefault + eventBonus + artifactBonus
  const extra = progress?.extra ?? 0
  const level = progress?.level ?? 0
  const growth = progress?.growth ?? 0
  const requireGrowth = symbol.levels?.find((l) => l.level === level)?.required_count || 0
  const isMax = equipped && level >= symbol.max_level

  // 남은 심볼 수 / 필요 메소 / 체납 메소
  let remainingSymbols = 0, remainingMeso = 0, arrearMeso = 0
  if (equipped && symbol.levels?.length) {
    let arrLv = level, arrG = growth
    while (arrLv < symbol.max_level) {
      const info = symbol.levels.find((l) => l.level === arrLv)
      if (info?.required_count == null || info?.meso_cost == null || arrG < info.required_count) break
      arrearMeso += info.meso_cost
      arrG -= info.required_count
      arrLv += 1
    }
    let g = growth
    for (const l of symbol.levels) {
      if (l.level < level) continue
      remainingSymbols += Math.max(l.required_count - g, 0)
      g = Math.max(g - l.required_count, 0)
      remainingMeso += l.meso_cost
    }
  }

  // 현재 성장치로 도달 가능한 레벨
  let reachableLevel = level
  if (equipped && !isMax) {
    let lv = level, g = growth
    while (lv < symbol.max_level) {
      const req = symbol.levels?.find((l) => l.level === lv)?.required_count
      if (!req || g < req) break
      g -= req
      lv += 1
    }
    reachableLevel = lv
  }
  /*
   * 만렙까지의 진행도.
   *
   * 레벨 안에서의 진행도(성장치/다음 레벨 필요치)는 레벨업마다 0으로 돌아가서
   * "만렙까지 얼마나 왔나"를 알 수 없다 — 이 계산기의 목적이 그건데도.
   * 그래서 1레벨부터 만렙까지 드는 총 심볼 수를 기준으로 잡는다.
   */
  let totalToMax = 0
  for (const l of symbol.levels || []) {
    if (l.level < symbol.max_level) totalToMax += l.required_count || 0
  }
  const investedToMax = Math.max(totalToMax - remainingSymbols, 0)
  const maxProgress = equipped
    ? (isMax ? 100 : (totalToMax ? (investedToMax / totalToMax) * 100 : 0))
    : 0

  const effectivelyMax = equipped && !isMax && reachableLevel >= symbol.max_level
  const interactable = equipped && !isMax && !effectivelyMax
  const remainingAfterExtra = Math.max(remainingSymbols - extra, 0)

  // 만렙 예상 완료일
  let daysLeft = null, completeDate = null
  if (equipped && !isMax) {
    const r = computeCompletion({
      remainingSymbols,
      daily,
      weeklyPerWeek: (weeklyCount || 0) * (symbol.weekly_default || 0),
      extra,
      dailyDone,
    })
    daysLeft = r.days
    completeDate = r.date
  }

  return {
    equipped, dailyDone, weeklyCount, baseDefault, eventBonus, artifactBonus, hasDailyOverride, daily, extra,
    level, growth, requireGrowth, isMax,
    totalToMax, investedToMax, maxProgress,
    remainingSymbols, remainingMeso, arrearMeso, reachableLevel, effectivelyMax, interactable,
    remainingAfterExtra, daysLeft, completeDate,
  }
}
