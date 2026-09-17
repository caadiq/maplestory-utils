import { describe, it, expect } from 'vitest'
import { normalizePotential, potentialCost, potentialSummary, groupPotential, sfCost, rowCeiling } from '../logic'
import { starforceCost } from '../costs'

describe('special currency enhancement history', () => {
  it('keeps Pulse costs out of meso totals and preserves the method name', () => {
    const rows = normalizePotential([
      { cube_type: '펄스 인핸서', target_item: '어센던트 펄스 링', item_level: 130, after_additional_potential_option: [{ value: 'STR +3%' }], after_potential_option: [] },
      { cube_type: '프라임 큐브', item_level: 130, potential_option_grade: '레전드리' },
      { cube_type: '프라임 에디셔널 큐브', item_level: 130, additional_potential_option_grade: '레전드리' },
    ], [])
    const pulse = rows.find((r) => r.method === 'special')
    expect(pulse.kind).toBe('additional')
    expect(potentialCost(pulse)).toBe(0)
    expect(potentialSummary(rows)).toMatchObject({ cube: 2, meso: 0, special: 1, cost: 676000 })
    expect(groupPotential([pulse])[0].methods).toEqual([{ iconName: '펄스 인핸서', count: 1 }])
    expect(rowCeiling(pulse)).toBeNull()
    expect(rows.find((r) => r.cube_type === '프라임 에디셔널 큐브').kind).toBe('additional')
  })
  it('counts meso enhancement of the same ring normally, but special currency costs zero', () => {
    const row = { target_item: '어센던트 펄스 링', before_starforce_count: 15 }
    expect(sfCost(row).final).toBe(starforceCost(row.target_item, 15))
    expect(sfCost({ ...row, upgrade_item: '펄스 인핸서', destroy_defence: '적용' }).final).toBe(0)
    expect(sfCost({ ...row, target_item: 'new unknown item', upgrade_item: '펄스 인핸서' }).final).toBe(0)
    const meso = normalizePotential([], [{ potential_type: '에디셔널 잠재능력', item_level: 130, additional_potential_option_grade: '유니크' }])[0]
    expect(potentialCost(meso)).toBe(66300000)
  })
})
