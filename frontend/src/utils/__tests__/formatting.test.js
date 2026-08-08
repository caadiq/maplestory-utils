import { describe, it, expect } from 'vitest'
import { formatMeso } from '../formatting'

describe('formatMeso', () => {
  it('0 이하는 "0" 반환', () => {
    expect(formatMeso(0)).toBe('0')
    expect(formatMeso(-100)).toBe('0')
    expect(formatMeso(null)).toBe('0')
    expect(formatMeso(undefined)).toBe('0')
  })

  it('1만 미만은 그대로 locale 표기', () => {
    expect(formatMeso(500)).toBe('500')
    expect(formatMeso(9999)).toBe('9,999')
  })

  it('만 단위만', () => {
    expect(formatMeso(10000)).toBe('1만')
    expect(formatMeso(12345)).toBe('1만')
    expect(formatMeso(99_990_000)).toBe('9,999만')
  })

  it('억 단위만', () => {
    expect(formatMeso(100_000_000)).toBe('1억')
    expect(formatMeso(500_000_000)).toBe('5억')
  })

  it('억 + 만 조합', () => {
    expect(formatMeso(100_010_000)).toBe('1억 1만')
    expect(formatMeso(123_456_789)).toBe('1억 2,345만')
    expect(formatMeso(2_576_000_000)).toBe('25억 7,600만')
  })


  it('문자열 입력도 처리', () => {
    expect(formatMeso('12345')).toBe('1만')
    expect(formatMeso('100000000')).toBe('1억')
  })
})
