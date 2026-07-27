// 보스 결정석 계산기 공용 로직 (PC·모바일 공유)

export const MAX_PER_CHARACTER = 12
export const MAX_PER_ACCOUNT = 90

// 난이도 영문 라벨 (버튼 표시용)
export const LABEL_EN = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD', chaos: 'CHAOS', extreme: 'EXTREME' }

/** 챌린저스 월드 캐릭터인지 (월드명에 '챌린저스' 포함) */
export function isChallengerWorld(worldName) {
  return (worldName || '').includes('챌린저스')
}

/** 시즌보스이면서 오늘이 시즌 기간 내인지 */
export function isSeasonActive(boss) {
  if (!boss?.season) return false
  const today = new Date().toISOString().slice(0, 10)
  return boss.season.start_date <= today && today <= boss.season.end_date
}

/** 이 캐릭터에게 노출할 시즌보스 목록 (챌린저스 월드 + 활성 시즌만) */
export function seasonBossesFor(worldName, bosses) {
  if (!isChallengerWorld(worldName)) return []
  return bosses.filter(isSeasonActive)
}

/**
 * 캐릭터별 주간 수익.
 * - 일반 보스: 수익 높은 상위 MAX_PER_CHARACTER개만 합산 (결정석 한도)
 * - 시즌보스: 메소 드랍이라 한도 미포함 — count에서 제외하고 수익만 합산 (활성 시즌만)
 * @returns {{ count: number, revenue: number, seasonRevenue: number }}
 */
export function charRevenue(charName, selections, bosses) {
  const charSel = selections[charName] || {}
  const normal = []
  let seasonRevenue = 0

  Object.entries(charSel).forEach(([bossId, sel]) => {
    if (!sel) return
    const boss = bosses.find((b) => b.id === Number(bossId))
    if (!boss) return
    const bd = boss.difficulties.find((d) => d.difficulty === sel.difficulty)
    if (!bd) return
    const value = Math.floor(bd.crystal_price / sel.party)
    if (boss.season) {
      if (isSeasonActive(boss)) seasonRevenue += value
    } else {
      normal.push(value)
    }
  })

  const items = normal.sort((a, b) => b - a).slice(0, MAX_PER_CHARACTER)
  return {
    count: items.length,
    revenue: items.reduce((s, v) => s + v, 0) + seasonRevenue,
    seasonRevenue,
  }
}
