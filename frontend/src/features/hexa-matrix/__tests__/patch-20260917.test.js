import { it, expect } from 'vitest'
import { EPIC_DUNGEONS, DEFAULT_SETTINGS, weeklyIncome, withCosts } from '../logic'

it('includes thick Erda energy in all Aurum reward tiers without multiplying fragments', () => {
  expect(EPIC_DUNGEONS.find((d) => d.id === 'aurum').erda).toEqual([2.5, 12.5, 22.5])
  for (const [multiplier, erda] of [[1, 2.5], [4, 12.5], [8, 22.5]]) {
    const result = weeklyIncome({ ...DEFAULT_SETTINGS, dungeon: 'aurum', multiplier, huntErdaPerDay: 0, huntFragPerDay: 0 })
    expect(result.erda).toBe(erda)
    expect(result.frag).toBe(15)
  }
})
it('retains reset cores at level zero with their full remaining cost', () => {
  const [core] = withCosts([{ name: 'reset', type: '스킬 코어', level: 0 }])
  expect(core.spentErda).toBe(0)
  expect(core.remainErda).toBe(150)
  expect(core.remainFrag).toBe(4500)
})
