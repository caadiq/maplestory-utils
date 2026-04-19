import { describe, it, expect } from 'vitest'
import { DIFFICULTIES, getDifficultyBadgeStyle, formatMeso, getDifficultyImageUrl } from '../constants'

describe('DIFFICULTIES', () => {
  it('5개 난이도 (easy, normal, hard, chaos, extreme)', () => {
    expect(DIFFICULTIES.map((d) => d.key)).toEqual(['easy', 'normal', 'hard', 'chaos', 'extreme'])
  })

  it('모든 항목에 key/label/initial/colors 존재', () => {
    DIFFICULTIES.forEach((d) => {
      expect(d.key).toBeTruthy()
      expect(d.label).toBeTruthy()
      expect(d.initial).toBeTruthy()
      expect(d.colors).toHaveProperty('bg')
      expect(d.colors).toHaveProperty('border')
      expect(d.colors).toHaveProperty('text')
    })
  })
})

describe('getDifficultyBadgeStyle', () => {
  it('난이도 객체를 CSS 스타일로 변환', () => {
    const s = getDifficultyBadgeStyle('easy')
    expect(s.backgroundColor).toBe('#999999')
    expect(s.borderColor).toBe('#999999')
    expect(s.color).toBe('#ffffff')
  })

  it('없는 key는 빈 객체', () => {
    expect(getDifficultyBadgeStyle('invalid')).toEqual({})
  })
})

describe('formatMeso (re-export from utils)', () => {
  it('utils/formatting의 formatMeso와 동일 동작', () => {
    expect(formatMeso(0)).toBe('0')
    expect(formatMeso(100_010_000)).toBe('1억 1만')
  })
})

describe('getDifficultyImageUrl', () => {
  it('S3 경로 규칙대로 URL 반환', () => {
    expect(getDifficultyImageUrl('easy'))
      .toBe('https://s3.caadiq.co.kr/maplestory/crystal/difficulty/easy.webp')
    expect(getDifficultyImageUrl('chaos'))
      .toBe('https://s3.caadiq.co.kr/maplestory/crystal/difficulty/chaos.webp')
  })
})
