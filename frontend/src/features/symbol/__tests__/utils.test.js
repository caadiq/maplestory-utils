import { describe, it, expect } from 'vitest'
import { formatKoreanDate, computeCompletion, TYPE_ORDER, eventBonusForType } from '../utils'

describe('TYPE_ORDER', () => {
  it('아케인 → 어센틱 → 그랜드 어센틱 순서', () => {
    expect(TYPE_ORDER).toEqual(['아케인', '어센틱', '그랜드 어센틱'])
  })
})

describe('formatKoreanDate', () => {
  it('YYYY년 MM월 DD일 (요일) 형식', () => {
    const d = new Date('2026-04-19T00:00:00+09:00')
    const s = formatKoreanDate(d)
    expect(s).toMatch(/^2026년 04월 19일 \([일월화수목금토]\)$/)
  })

  it('월/일 2자리 zero-padding', () => {
    expect(formatKoreanDate(new Date('2026-01-05T00:00:00+09:00')))
      .toMatch(/^2026년 01월 05일 /)
  })
})

describe('computeCompletion', () => {
  it('need가 0 (extra로 커버)이면 days 0', () => {
    const r = computeCompletion({
      remainingSymbols: 100,
      daily: 1,
      weeklyPerWeek: 0,
      extra: 200,
      dailyDone: false,
    })
    expect(r.days).toBe(0)
    expect(r.date).toBeInstanceOf(Date)
  })

  it('daily/weekly 모두 0이면 불가능', () => {
    const r = computeCompletion({
      remainingSymbols: 100,
      daily: 0,
      weeklyPerWeek: 0,
      extra: 0,
      dailyDone: false,
    })
    expect(r.days).toBeNull()
    expect(r.date).toBeNull()
  })

  it('일퀘 하루 1개 · 100개 필요 → 100일 후 완료', () => {
    const r = computeCompletion({
      remainingSymbols: 100,
      daily: 1,
      weeklyPerWeek: 0,
      extra: 0,
      dailyDone: false,
    })
    // dailyDone=false라 오늘(day 0)도 적립 → 1/day 누적 100일
    expect(r.days).toBe(99) // day 0: 1, day 1: 2, ..., day 99: 100 ≥ 100
  })

  it('dailyDone이면 오늘은 적립 안 됨 → 하루 더 걸림', () => {
    const r1 = computeCompletion({
      remainingSymbols: 10, daily: 1, weeklyPerWeek: 0, extra: 0, dailyDone: false,
    })
    const r2 = computeCompletion({
      remainingSymbols: 10, daily: 1, weeklyPerWeek: 0, extra: 0, dailyDone: true,
    })
    expect(r2.days).toBe(r1.days + 1)
  })

  it('extra가 remaining을 전부 덮으면 즉시 완료', () => {
    const r = computeCompletion({
      remainingSymbols: 50,
      daily: 5,
      weeklyPerWeek: 10,
      extra: 100,
      dailyDone: false,
    })
    expect(r.days).toBe(0)
  })
})

describe('eventBonusForType', () => {
  const skill = { skill_name: '메이플 스위츠', skill_level: 1, arcane_daily: 3, authentic_daily: 7 }

  it('event_skill이 없으면 0', () => {
    expect(eventBonusForType(null, '아케인')).toBe(0)
    expect(eventBonusForType(undefined, '어센틱')).toBe(0)
  })

  it('아케인 타입은 arcane_daily 반환', () => {
    expect(eventBonusForType(skill, '아케인')).toBe(3)
  })

  it('어센틱/그랜드 어센틱 타입은 authentic_daily 반환', () => {
    expect(eventBonusForType(skill, '어센틱')).toBe(7)
    expect(eventBonusForType(skill, '그랜드 어센틱')).toBe(7)
  })

  it('알 수 없는 타입은 0', () => {
    expect(eventBonusForType(skill, '기타')).toBe(0)
  })

  it('해당 필드가 누락되어도 0으로 처리', () => {
    expect(eventBonusForType({ skill_name: 'X', skill_level: 1 }, '아케인')).toBe(0)
  })
})
