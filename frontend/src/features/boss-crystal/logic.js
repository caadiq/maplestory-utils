// 보스 결정석 계산기 공용 로직 (PC·모바일 공유)

export const MAX_PER_CHARACTER = 12
export const MAX_PER_ACCOUNT = 90

// 난이도 영문 라벨 (버튼 표시용)
export const LABEL_EN = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD', chaos: 'CHAOS', extreme: 'EXTREME' }

/**
 * 캐릭터별 주간 수익 — 수익 높은 상위 MAX_PER_CHARACTER 보스만 합산.
 * @returns {{ count: number, revenue: number }}
 */
export function charRevenue(charName, selections, bosses) {
  const charSel = selections[charName] || {}
  const items = Object.entries(charSel)
    .filter(([, sel]) => sel)
    .map(([bossId, sel]) => {
      const boss = bosses.find((b) => b.id === Number(bossId))
      if (!boss) return null
      const bd = boss.difficulties.find((d) => d.difficulty === sel.difficulty)
      if (!bd) return null
      return Math.floor(bd.crystal_price / sel.party)
    })
    .filter((v) => v != null)
    .sort((a, b) => b - a)
    .slice(0, MAX_PER_CHARACTER)
  return { count: items.length, revenue: items.reduce((s, v) => s + v, 0) }
}
