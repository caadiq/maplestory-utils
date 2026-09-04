import { describe, it, expect } from 'vitest'
import { walk, breakdown, epicAt, zoneOn, defaultSettings } from '../logic'

/*
 * 실제 데이터 일부(Lv.210~227) — 리조트 실측 사례를 그대로 재현한다.
 * 화면 표시 2021.87%(212 고정 환산)가 실제로는 13레벨이라는 것이 이 기능의 출발점이다.
 */
const levelExp = {
  210: 7344309856, 211: 8152183940, 212: 9048924173, 213: 10044305832, 214: 11149179473,
  215: 13379015367, 216: 14583126750, 217: 15895608157, 218: 17326212891, 219: 18885572051,
  220: 22662686461, 221: 24249074513, 222: 25946509728, 223: 27762765408, 224: 29706158986,
  225: 35647390783, 226: 38142708137, 227: 40812697706,
}
const sauna = {
  210: 9723714120, 211: 9934678080, 212: 10164300768, 213: 10370290212, 214: 10593218880,
  215: 10847381760, 216: 11077677360, 217: 11336481360, 218: 11569466880, 219: 11832366240,
  220: 17330317920, 221: 17713694160, 222: 18058486320, 223: 18447350400, 224: 18797798160,
  225: 19192317840, 226: 19590814080, 227: 19948093920,
}
const flat = (v) => Object.fromEntries(Object.keys(levelExp).map((k) => [k, v]))

const data = {
  levelExp,
  daily: {
    arcane: [{ id: 'yeoro', minLevel: 200, exp: 1e9 }, { id: 'chewchew', minLevel: 210, exp: 2e9 }],
    tenebris: [{ id: 'moonbridge', minLevel: 245, exp: 3e9 }],
    grandis: [{ id: 'cernium', minLevel: 260, exp: 4e9 }],
  },
  monsterPark: { zones: [{ id: 'yeoro', minLevel: 200, exp: { normal: 1e9, sunday: 1.5e9, special: 4e9 } }] },
  epicDungeon: {
    stages: [1, 5, 9],
    dungeons: [
      { id: 'high_mountain', name: '하이마운틴', minLevel: 260, base: flat(1e9) },
      { id: 'angler_company', name: '앵글러 컴퍼니', minLevel: 270, base: flat(2e9) },
      { id: 'nightmare_paradise', name: '악몽선경', minLevel: 280, base: flat(3e9) },
    ],
  },
  extremePark: { minLevel: 260, byLevel: flat(1e9) },
  sauna: { hourly: sauna },
  farms: {
    golden: { minLevel: 200, maxLevel: 259, byLevel: flat(1e9) },
    blue: { minLevel: 260, byLevel: flat(1e9) },
    mech: { minLevel: 280, byLevel: flat(1e9) },
    crimson: { minLevel: 280, byLevel: flat(1e9) },
  },
  elixirs: [{ id: 'e249', capLevel: 249, exp: 155483188174 }],
  levelElixirs: [{ id: 'e200lv', exp: 11462335230 }, { id: 'e250lv', exp: 2487551550217 }],
  coupons: { normal: { byLevel: flat(1e8) }, upper: { minLevel: 260, byLevel: flat(1e9) } },
}

const settings = (over = {}) => {
  const s = defaultSettings(212)
  return { ...s, ...over, weekly: { ...s.weekly, ...(over.weekly || {}) }, items: { ...s.items, ...(over.items || {}) } }
}

describe('walk', () => {
  it('렙업이 없으면 예전 환산(abs / E)과 정확히 같다', () => {
    const r = walk(data, 212, 23.911, [levelExp[212] * 0.3])
    expect(r.levels).toBe(0)
    expect(r.pct).toBeCloseTo(30, 6)
    expect(r.rate).toBeCloseTo(53.911, 6)
  })

  it('Lv.212 23.911%에서 리조트 18시간 — 2021%가 아니라 13레벨(Lv.225 56.8%)이다', () => {
    const perMin = (l) => sauna[l] / 60
    const r = walk(data, 212, 23.911, new Array(18 * 60).fill(perMin))
    expect(r.level).toBe(225)
    expect(r.rate).toBeCloseTo(56.755, 1)
    expect(r.pct).toBeCloseTo(13 * 100 + 56.755 - 23.911, 0)
  })

  it('chunk 함수는 그 시점의 레벨을 받는다 — 렙업하면 값이 바뀐다', () => {
    const seen = []
    walk(data, 212, 99, [(l) => { seen.push(l); return levelExp[l] * 0.02 }, (l) => { seen.push(l); return 0 }])
    expect(seen).toEqual([212, 213])
  })

  it('출발 %가 범위를 벗어나도 무너지지 않는다', () => {
    expect(walk(data, 212, 120, [0]).level).toBe(212)
    expect(walk(data, 212, -5, [0]).pct).toBe(0)
    expect(walk(data, 300, 0, [1e12]).level).toBe(300)   // 테이블 밖 — 만렙에서 더 못 오른다
  })
})

describe('epicAt', () => {
  it('입장 못 하는 던전을 고르고 있으면 입장 가능한 최고 던전으로 본다', () => {
    expect(epicAt(270, data, 'nightmare_paradise').id).toBe('angler_company')
  })
  it('auto는 최고 던전', () => {
    expect(epicAt(285, data, 'auto').id).toBe('nightmare_paradise')
    expect(epicAt(262, data, undefined).id).toBe('high_mountain')
  })
  it('하나도 못 들어가면 null', () => {
    expect(epicAt(212, data, 'auto')).toBeNull()
  })
})

describe('기본값·zoneOn', () => {
  it('새 설정은 전부 꺼져 있다', () => {
    const s = defaultSettings(212)
    expect(s.v).toBe(2)
    expect(s.weekly.epic.on).toBe(false)
    expect(s.weekly.extreme.on).toBe(false)
    expect(zoneOn(s, 'yeoro')).toBe(false)
    expect(zoneOn({ ...s, daily: { yeoro: true } }, 'yeoro')).toBe(true)
  })
  it('예전 설정(v 없음)은 기본 켜짐을 유지한다 — 저장해 둔 캐릭터가 갑자기 꺼지면 안 된다', () => {
    expect(zoneOn({ daily: {} }, 'yeoro')).toBe(true)
    expect(zoneOn({ daily: { yeoro: false } }, 'yeoro')).toBe(false)
  })
})

describe('breakdown', () => {
  it('리조트 합계가 걸은 값이고 도착점(reach)이 붙는다', () => {
    const bd = breakdown(data, 212, settings({ weekly: { mvpHours: 18 } }), null, 23.911)
    expect(bd.reach.diving.level).toBe(225)
    expect(bd.divingTotal).toBeCloseTo(bd.reach.diving.pct, 9)
    expect(bd.mvp).toBeCloseTo(bd.divingTotal, 9)          // VIP가 0이면 둘이 같다
    expect(bd.saunaHourPct).toBeCloseTo(112.33, 1)          // 단가는 여전히 212 기준 환산
  })

  it('성장의 비약(캡 미만)은 %를 유지한 채 레벨만 하나 올린다', () => {
    const bd = breakdown(data, 212, settings({ items: { elixirCounts: { e249: 5 } } }), null, 23.911)
    expect(bd.reach.elixir.level).toBe(217)
    expect(bd.reach.elixir.rate).toBeCloseTo(23.911, 6)
    expect(bd.elixirTotal).toBeCloseTo(500, 6)
  })

  it('레벨이 안 되는 항목은 잠기고 0이다', () => {
    const bd = breakdown(data, 212, settings({ weekly: { epic: { on: true, dungeon: 'auto', stage: 2 }, extreme: { on: true } }, items: { couponUpper: 3, e250lv: 2 } }), null, 0)
    expect(bd.epic.locked).toBe(true)
    expect(bd.epic.minLevel).toBe(260)
    expect(bd.extreme.locked).toBe(true)
    expect(bd.epic.total).toBe(0)
    expect(bd.couponULocked).toBe(true)
    expect(bd.couponU).toBe(0)
    expect(bd.e250Locked).toBe(true)
    expect(bd.e250).toBe(0)
  })

  it('황금 딸기 농장은 걷다가 최대 레벨을 넘기면 그 뒤 입장권이 0이다', () => {
    // 1회가 정확히 Lv.212 한 레벨치, 입장은 212까지 — 첫 장으로 213이 되면 나머지 넉 장은 못 쓴다
    const big = { ...data, farms: { ...data.farms, golden: { minLevel: 200, maxLevel: 212, byLevel: flat(levelExp[212]) } } }
    const bd = breakdown(big, 212, settings({ items: { farmGolden: 5 } }), null, 0)
    expect(bd.reach.farm.level).toBe(213)
    expect(bd.reach.farm.rate).toBeCloseTo(0, 6)
    expect(bd.farmTotal).toBeCloseTo(100, 6)
  })

  it('묶은 일퀘 그룹은 한 번에 걷는다', () => {
    const s = settings({ daily: { yeoro: true, chewchew: true } })
    const bd = breakdown(data, 212, s, null, 0)
    const g = bd.daily.of(['arcane', 'tenebris'])
    expect(g.pct).toBeCloseTo(((1e9 + 2e9) / levelExp[212]) * 100, 6)
  })
})
