import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {
  bossEarn,
  calcWeekPoints,
  calcDoneEarn,
  calcMonthlyEarn,
  getSchedulerWeekRange,
  computeCompletionDate,
} from '../utils'
import { calcPoints, WEEKLY_BOSSES } from '../data'
import { makeEmptyWeekly } from '../store'

dayjs.extend(utc)
dayjs.extend(timezone)

describe('calcPoints', () => {
  it('파티원 수로 나누고 버림', () => {
    expect(calcPoints(100, 1)).toBe(100)
    expect(calcPoints(100, 3)).toBe(33)
    expect(calcPoints(50, 2)).toBe(25)
    expect(calcPoints(7, 2)).toBe(3) // Math.floor(3.5) = 3
  })
})

describe('bossEarn', () => {
  const suu = WEEKLY_BOSSES.find((b) => b.key === 'lotus') // 스우

  it('선택 없음이면 0', () => {
    expect(bossEarn(suu, null)).toBe(0)
    expect(bossEarn(suu, undefined)).toBe(0)
  })

  it('존재하지 않는 난이도면 0', () => {
    expect(bossEarn(suu, { difficulty: 'invalid', party: 1 })).toBe(0)
  })

  it('난이도별 점수를 파티 수로 분배', () => {
    // 스우 하드 = 50점
    expect(bossEarn(suu, { difficulty: 'hard', party: 1 })).toBe(50)
    expect(bossEarn(suu, { difficulty: 'hard', party: 2 })).toBe(25)
    expect(bossEarn(suu, { difficulty: 'hard', party: 3 })).toBe(16) // floor(50/3)
  })
})

describe('calcWeekPoints / calcDoneEarn', () => {
  it('빈 주간 설정은 0', () => {
    const empty = makeEmptyWeekly()
    expect(calcWeekPoints(empty)).toBe(0)
    expect(calcDoneEarn(empty)).toBe(0)
  })

  it('선택된 보스의 점수 합산', () => {
    const cfg = makeEmptyWeekly()
    cfg.bosses.lotus = { difficulty: 'hard', party: 1, done: false } // 50
    cfg.bosses.damien = { difficulty: 'normal', party: 1, done: false } // 10
    expect(calcWeekPoints(cfg)).toBe(60)
    expect(calcDoneEarn(cfg)).toBe(0) // 완료 없음
  })

  it('done=true인 것만 calcDoneEarn 합산', () => {
    const cfg = makeEmptyWeekly()
    cfg.bosses.lotus = { difficulty: 'hard', party: 1, done: true }
    cfg.bosses.damien = { difficulty: 'normal', party: 1, done: false }
    expect(calcWeekPoints(cfg)).toBe(60)
    expect(calcDoneEarn(cfg)).toBe(50)
  })
})

describe('calcMonthlyEarn', () => {
  it('검은 마법사 난이도별 점수', () => {
    const cfg = makeEmptyWeekly()
    expect(calcMonthlyEarn(cfg)).toBe(0) // 기본은 none

    cfg.blackMage = { difficulty: 'hard', party: 1, done: false }
    expect(calcMonthlyEarn(cfg)).toBe(600)

    cfg.blackMage = { difficulty: 'hard', party: 2, done: false }
    expect(calcMonthlyEarn(cfg)).toBe(300)
  })
})

describe('getSchedulerWeekRange', () => {
  it('1주차는 시작일부터 다음 목요일 전날까지', () => {
    // 2026-04-19 일요일 시작 → 다음 목요일 2026-04-23
    const r = getSchedulerWeekRange('2026-04-19T00:00:00+09:00', 1)
    expect(r.start.format('YYYY-MM-DD')).toBe('2026-04-19')
    expect(r.end.format('YYYY-MM-DD')).toBe('2026-04-22') // 목요일 전날 (수요일)
  })

  it('2주차는 다음 목요일부터 7일', () => {
    const r = getSchedulerWeekRange('2026-04-19T00:00:00+09:00', 2)
    expect(r.start.format('YYYY-MM-DD')).toBe('2026-04-23')
    expect(r.end.format('YYYY-MM-DD')).toBe('2026-04-29')
  })

  it('목요일에 시작하면 그 목요일이 1주차', () => {
    // 2026-04-23 목요일 시작
    const r1 = getSchedulerWeekRange('2026-04-23T00:00:00+09:00', 1)
    expect(r1.start.format('YYYY-MM-DD')).toBe('2026-04-23')
    // 1주차 end는 다음 목요일(4/30) 전날 = 4/29
    expect(r1.end.format('YYYY-MM-DD')).toBe('2026-04-29')
  })
})

describe('computeCompletionDate (단순 계산)', () => {
  const baseParams = {
    calcMode: 'simple',
    alreadyDone: false,
    monthlyDoneThisMonth: false,
  }

  it('alreadyDone이면 오늘 반환', () => {
    const r = computeCompletionDate({
      ...baseParams,
      alreadyDone: true,
      state: { startDate: '2026-04-19T00:00:00+09:00' },
      remaining: 0,
      weeklyEarn: 0,
      doneEarn: 0,
      monthlyEarn: 0,
    })
    expect(r).toBeInstanceOf(Date)
  })

  it('remaining=0이면 시작일 반환', () => {
    const r = computeCompletionDate({
      ...baseParams,
      state: { startDate: '2026-04-19T00:00:00+09:00' },
      remaining: 0,
      weeklyEarn: 100,
      doneEarn: 0,
      monthlyEarn: 0,
    })
    expect(r).toBeInstanceOf(Date)
    expect(dayjs(r).tz('Asia/Seoul').format('YYYY-MM-DD')).toBe('2026-04-19')
  })

  it('weeklyEarn=0, monthlyEarn=0이면 null', () => {
    const r = computeCompletionDate({
      ...baseParams,
      state: { startDate: '2026-04-19T00:00:00+09:00' },
      remaining: 1000,
      weeklyEarn: 0,
      doneEarn: 0,
      monthlyEarn: 0,
    })
    expect(r).toBeNull()
  })

  it('주 100점 · 6500점 필요 → 약 65주 후 완료', () => {
    const r = computeCompletionDate({
      ...baseParams,
      state: { startDate: '2026-04-19T00:00:00+09:00' }, // 일요일
      remaining: 6500,
      weeklyEarn: 100,
      doneEarn: 0,
      monthlyEarn: 0,
    })
    expect(r).toBeInstanceOf(Date)
    // 시작 2026-04-19 + 65주 = 2027-07-22 전후 (약 1년 3개월)
    const days = dayjs(r).diff(dayjs('2026-04-19T00:00:00+09:00'), 'day')
    expect(days).toBeGreaterThan(400)
    expect(days).toBeLessThan(500)
  })

  it('월간 검은 마법사도 반영', () => {
    // 주간 0, 월간 600, remaining 1200 → 2회 검마 필요 → 2개월 후
    const r = computeCompletionDate({
      ...baseParams,
      state: { startDate: '2026-04-19T00:00:00+09:00' },
      remaining: 1200,
      weeklyEarn: 0,
      doneEarn: 0,
      monthlyEarn: 600,
      monthlyDoneThisMonth: false,
    })
    expect(r).toBeInstanceOf(Date)
    // 시작 당일 1회 + 다음달 1회 = 2개월 후
    expect(dayjs(r).tz('Asia/Seoul').format('YYYY-MM-DD')).toBe('2026-05-01')
  })
})

describe('computeCompletionDate (주차별 계산)', () => {
  it('schedulerWeeks가 비어있으면 null', () => {
    const r = computeCompletionDate({
      calcMode: 'weekly',
      state: { startDate: '2026-04-19T00:00:00+09:00', schedulerWeeks: [] },
      alreadyDone: false,
      remaining: 1000,
      weeklyEarn: 0,
      doneEarn: 0,
      monthlyEarn: 0,
      monthlyDoneThisMonth: false,
    })
    expect(r).toBeNull()
  })

  it('1주차 + 2주차 설정이 서로 다르게 적립', () => {
    const week1 = makeEmptyWeekly()
    week1.bosses.lotus = { difficulty: 'hard', party: 1, done: false } // 50
    const week2 = makeEmptyWeekly()
    week2.bosses.lotus = { difficulty: 'hard', party: 1, done: false }
    week2.bosses.damien = { difficulty: 'hard', party: 1, done: false } // +50 = 100

    const r = computeCompletionDate({
      calcMode: 'weekly',
      state: {
        startDate: '2026-04-19T00:00:00+09:00',
        schedulerWeeks: [
          { id: 1, config: week1 },
          { id: 2, config: week2 },
        ],
      },
      alreadyDone: false,
      remaining: 6500,
      weeklyEarn: 0,
      doneEarn: 0,
      monthlyEarn: 0,
      monthlyDoneThisMonth: false,
    })
    // 1주차 50 + 2주차+ 매주 100 → 6500 도달까지 대략 65주
    expect(r).toBeInstanceOf(Date)
  })
})

describe('computeCompletionDate (제네시스 패스 배수)', () => {
  const base = {
    calcMode: 'simple',
    alreadyDone: false,
    monthlyDoneThisMonth: false,
    state: { startDate: '2026-04-19T00:00:00+09:00' }, // 일요일
    remaining: 300,
    weeklyEarn: 100,
    doneEarn: 0,
    monthlyEarn: 0,
  }

  it('패스 적용 시 포인트가 배수로 적립되어 더 빨리 완료', () => {
    // 패스 없음: day0 100 → 매주 100 → 300 도달까지 시작일 이후 몇 주 소요
    const noPass = computeCompletionDate(base)
    // 패스 3배(충분히 긴 기간): day0 100×3=300 → 시작일 당일 도달
    const withPass = computeCompletionDate({
      ...base,
      pass: { multiplier: 3, startDate: '2026-04-01', endDate: '2026-12-31' },
    })
    expect(dayjs(withPass).tz('Asia/Seoul').format('YYYY-MM-DD')).toBe('2026-04-19')
    expect(dayjs(noPass).isAfter(dayjs(withPass))).toBe(true)
  })

  it('패스 기간 밖(이미 지난 시즌)이면 배수 미적용', () => {
    const expired = computeCompletionDate({
      ...base,
      pass: { multiplier: 3, startDate: '2020-01-01', endDate: '2020-12-31' },
    })
    const noPass = computeCompletionDate(base)
    expect(dayjs(expired).isSame(dayjs(noPass))).toBe(true)
  })

  it('월간 보스 포인트에도 배수 적용', () => {
    // 주간 0, 월간 600, remaining 1800. 패스 없으면 3회(3개월) 필요
    // 패스 3배면 day0 검마 600×3=1800 → 시작일 당일 도달
    const withPass = computeCompletionDate({
      ...base,
      remaining: 1800,
      weeklyEarn: 0,
      monthlyEarn: 600,
      pass: { multiplier: 3, startDate: '2026-04-01', endDate: '2026-12-31' },
    })
    expect(dayjs(withPass).tz('Asia/Seoul').format('YYYY-MM-DD')).toBe('2026-04-19')
  })
})
