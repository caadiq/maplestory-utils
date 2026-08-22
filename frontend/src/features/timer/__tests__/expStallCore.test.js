import { describe, it, expect } from 'vitest'
import { EXP_STALL, stallBand, whiteProfile, profileStrength, profileDiff, shouldAlert } from '../expStallCore'

/** 띠 하나를 RGBA로 만든다. paint(x, y) → [r,g,b] */
function band(w, h, paint) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y)
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return data
}

const DARK = () => [20, 26, 34]
/** 노란 경험치 게이지 — 파랑이 거의 없다 */
const YELLOW = () => [232, 226, 40]
/** x가 cols에 들어가면 흰 글자 */
const text = (bg, cols) => (x, y) => (cols.has(x) && y >= 3 && y <= 10 ? [255, 255, 255] : bg(x, y))

describe('stallBand', () => {
  it('1080p에서 화면 아래 가운데 띠를 잡는다', () => {
    expect(stallBand(1920, 1080)).toEqual({ x: 768, y: 1064, w: 384, h: 14 })
  })

  it('해상도가 달라도 바닥에 붙어 가운데를 본다', () => {
    const b = stallBand(2560, 1440)
    // 맨 아래 몇 px은 일부러 뺀다 (1080p 기준 2px) — 글자는 그 위에 있다
    expect(1440 - (b.y + b.h)).toBeLessThanOrEqual(4)
    expect(b.x).toBe(1024)
    expect(b.h).toBeGreaterThan(10)
  })
})

describe('whiteProfile', () => {
  it('노란 게이지는 배경으로 떨어지고 흰 글자만 남는다', () => {
    const cols = new Set([10, 11, 12])
    const onDark = whiteProfile(band(40, 14, text(DARK, cols)), 40, 14)
    const onYellow = whiteProfile(band(40, 14, text(YELLOW, cols)), 40, 14)
    // 글자가 없는 열은 어느 배경에서든 0
    expect(onDark[0]).toBe(0)
    expect(onYellow[0]).toBe(0)
    // 글자가 있는 열은 양쪽 다 크게 남는다
    expect(onDark[10]).toBeGreaterThan(0)
    expect(onYellow[10]).toBeGreaterThan(0)
  })

  it('글자가 없으면 세기가 판정선 아래로 떨어진다', () => {
    const p = whiteProfile(band(384, 14, DARK), 384, 14)
    expect(profileStrength(p, 384, 14)).toBeLessThan(EXP_STALL.textFloor)
  })
})

describe('profileDiff', () => {
  const make = (cols) => whiteProfile(band(384, 14, text(DARK, new Set(cols))), 384, 14)
  /** 글자 20개를 흉내낸다 — 한 글자는 4px, 사이는 2px (실제 글자와 비슷한 굵기) */
  const digits = (from, count = 20) => {
    const cols = []
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) cols.push(from + i * 6 + k)
    }
    return cols
  }

  it('같은 화면이면 0이다 (= 경험치가 멈춤)', () => {
    const a = make(digits(100))
    expect(profileDiff(a, a)).toBe(0)
  })

  /*
   * 경험치는 한 번 오를 때 아래 자릿수가 여러 개 함께 바뀐다(실측 프레임에서 0.176 이상).
   * 스무 글자 중 다섯이 바뀌는 정도면 판정선을 넉넉히 넘는다.
   * 참고로 세 글자만 바뀌면 딱 0.10이라 판정선과 같아진다 — 실제로는 그만큼만 바뀌지 않는다.
   */
  it('끝의 몇 글자가 바뀌면 판정선을 넘는다', () => {
    const a = make(digits(100))
    const b = make([...digits(100).slice(0, 15 * 4), ...digits(193, 5)])
    expect(profileDiff(a, b)).toBeGreaterThan(EXP_STALL.changeThreshold)
  })

  it('자릿수가 늘어 글자가 통째로 밀려도 변화로 잡는다', () => {
    expect(profileDiff(make(digits(100)), make(digits(103)))).toBeGreaterThan(EXP_STALL.changeThreshold)
  })

  it('직전 값이 없으면 변화로 본다 (멈춤으로 오인하지 않게)', () => {
    expect(profileDiff(null, make(digits(100)))).toBe(1)
  })
})

describe('shouldAlert', () => {
  const LIMIT = 15000
  const REPEAT = 20000

  it('판정 시간을 못 채우면 안 울린다', () => {
    expect(shouldAlert(14999, LIMIT, null, REPEAT)).toBe(false)
  })

  it('판정 시간을 넘기면 처음 한 번 울린다', () => {
    expect(shouldAlert(LIMIT, LIMIT, null, REPEAT)).toBe(true)
  })

  it('반복 간격을 못 채우면 다시 안 울린다', () => {
    expect(shouldAlert(30000, LIMIT, 19999, REPEAT)).toBe(false)
  })

  it('반복 간격이 지나면 다시 울린다', () => {
    expect(shouldAlert(40000, LIMIT, REPEAT, REPEAT)).toBe(true)
  })

  it('반복을 끄면 처음 한 번만 울린다', () => {
    expect(shouldAlert(LIMIT, LIMIT, null, 0)).toBe(true)
    expect(shouldAlert(600000, LIMIT, 600000, 0)).toBe(false)
  })

  it('반복 간격은 판정 시간과 따로 논다', () => {
    // 판정 15초 · 반복 60초 — 판정 시간만 지났다고 다시 울리면 안 된다
    expect(shouldAlert(35000, LIMIT, 20000, 60000)).toBe(false)
  })
})
