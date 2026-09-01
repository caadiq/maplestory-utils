import { describe, it, expect } from 'vitest'
import {
  NAMEPLATE, toGray, inkWidth, resample, normalizePatch, nccAt,
  widthCandidates, calibrate, scoreProfiles, decide, searchBand,
} from '../nameplateCore'

/** RGBA를 만든다. paint(x,y) → [r,g,b] */
function make(w, h, paint) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y)
      const i = (y * w + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return d
}

const INK = [196, 218, 225]   // 닉네임 글자색 FFC4DAE1
const PLATE = [40, 46, 58]    // 반투명 판 배경

/** 글자 흉내 — 주어진 열 묶음에만 세로획을 세운다 */
const glyphs = (cols, h) => (x, y) => (cols.includes(x) && y > 2 && y < h - 3 ? INK : PLATE)

describe('inkWidth', () => {
  it('글자가 끝나는 자리까지만 잰다', () => {
    // 0~2, 6~8 에 획이 있고 그 뒤는 비어 있다 → 폭 9
    const d = make(40, 16, glyphs([0, 1, 2, 6, 7, 8], 16))
    expect(inkWidth(d, 40, 16, 1)).toBe(9)
  })

  it('글자 사이 공백은 이어 붙인다 (닉네임 중간에서 끊기면 안 된다)', () => {
    const d = make(40, 16, glyphs([0, 1, 4, 5, 8, 9], 16))
    expect(inkWidth(d, 40, 16, 1)).toBe(10)
  })

  it('글자가 없으면 0', () => {
    expect(inkWidth(make(40, 16, () => PLATE), 40, 16, 1)).toBe(0)
  })

  it('한 점짜리 잡음은 글자로 안 본다', () => {
    const d = make(40, 16, (x, y) => (x === 20 && y === 8 ? INK : PLATE))
    expect(inkWidth(d, 40, 16, 1)).toBe(0)
  })
})

describe('resample · normalizePatch · nccAt', () => {
  it('자기 자신과는 1.0', () => {
    const g = new Float32Array(60)
    for (let i = 0; i < 60; i++) g[i] = (i * 37) % 101
    const tpl = normalizePatch(g.slice(0, 60))
    expect(nccAt(g, 10, 6, tpl, 10, 6, 0, 0)).toBeCloseTo(1, 5)
  })

  it('평탄한 창은 -1 (NCC가 성립하지 않는다)', () => {
    const flat = new Float32Array(60).fill(7)
    const tpl = normalizePatch(new Float32Array([1, 2, 3, 4, 5, 6]))
    expect(nccAt(flat, 10, 6, tpl, 3, 2, 0, 0)).toBe(-1)
  })

  it('창이 평면 밖으로 나가면 -1', () => {
    const g = new Float32Array(60)
    const tpl = normalizePatch(new Float32Array([1, 2, 3, 4]))
    expect(nccAt(g, 10, 6, tpl, 2, 2, 9, 0)).toBe(-1)
    expect(nccAt(g, 10, 6, tpl, 2, 2, -1, 0)).toBe(-1)
  })

  it('리샘플은 크기만 바꾸고 값 범위를 안 벗어난다', () => {
    const src = new Float32Array([0, 100, 0, 100])
    const up = resample(src, 2, 2, 4, 4)
    expect(up.length).toBe(16)
    expect(Math.max(...up)).toBeLessThanOrEqual(100.001)
    expect(Math.min(...up)).toBeGreaterThanOrEqual(-0.001)
  })
})

describe('widthCandidates', () => {
  it('배율 힌트로 중심을 잡고 그 둘레를 준다', () => {
    const p = { pw: 76, scale: 1.406 }
    const w = widthCandidates(p, 1.086)
    expect(w).toContain(59)          // 76 × 1.086/1.406 ≈ 58.7
    expect(Math.min(...w)).toBeLessThan(59)
    expect(Math.max(...w)).toBeGreaterThan(59)
  })

  it('배율이 8% 어긋나도 후보 안에 정답 폭이 들어온다', () => {
    /*
     * 경험치 바로 구한 배율은 확장 UI에서 8% 높게 나온다(뷰포트 902px, UI는 838px 상당).
     * 폭 68이 나오는 자리에 실제로는 76이 필요했다 — 절대 ±4로는 못 닿는다(실측).
     */
    const p = { pw: 57, scale: 1.174 }
    expect(widthCandidates(p, 1.401)).toContain(76)
  })

  it('배율이 크게 틀려도 후보가 음수로 안 간다', () => {
    expect(Math.min(...widthCandidates({ pw: 8, scale: 4 }, 0.1, 4))).toBeGreaterThanOrEqual(6)
  })
})

describe('calibrate · scoreProfiles', () => {
  /*
   * 넓은 띠 한가운데에 닉네임 판을 심어 두고, 자리를 모른 채 찾아내는지 본다.
   * 실제 화면에서 게임 왼쪽 끝을 못 믿기 때문에 이 방식을 쓴다 (nameplateCore 주석 참고).
   *
   * 글자는 **비주기적으로** 그린다. 같은 높이의 세로획을 규칙적으로 세우면
   * 좁힌 창이 옆자리에서도 비슷하게 맞아 (실제 닉네임에는 없는) 자기유사성이 생긴다.
   */
  const BW = 300; const BH = 26
  const PW = 28; const PH = 16
  const PLANT_X = 173; const PLANT_Y = 5

  /** seed로 정해지는 들쭉날쭉한 획 — 열마다 높이·굵기가 다르다 */
  const strokes = (seed) => {
    const col = []
    let v = seed
    for (let x = 0; x < PW; x++) {
      v = (v * 1103515245 + 12345) & 0x7fffffff
      col.push((v >> 8) % 5 === 0 ? 0 : 2 + ((v >> 12) % 6))   // 0이면 빈 열
    }
    return (x, y) => {
      const hgt = col[x] || 0
      return hgt && y >= 3 && y < 3 + hgt ? INK : PLATE
    }
  }

  const bandWith = (paint) => toGray(make(BW, BH, (x, y) => {
    const lx = x - PLANT_X; const ly = y - PLANT_Y
    if (lx >= 0 && lx < PW && ly >= 0 && ly < PH) return paint(lx, ly)
    return [90 + ((x * 7) % 40), 70 + ((y * 11) % 30), 120 + ((x + y) % 35)]  // 잡다한 게임 화면
  }))
  const profileFrom = (paint, id) => ({
    id, patch: toGray(make(PW, PH, paint)), pw: PW, ph: PH, scale: 1,
  })

  const A = strokes(7)
  const B = strokes(9091)
  const pA = profileFrom(A, 'A')
  const pB = profileFrom(B, 'B')

  it('자리를 몰라도 띠에서 찾아낸다', () => {
    const spot = calibrate(bandWith(A), BW, BH, [pA, pB], 1)
    expect(spot).not.toBeNull()
    expect(Math.abs(spot.x - PLANT_X)).toBeLessThanOrEqual(2)
    expect(Math.abs(spot.y - PLANT_Y)).toBeLessThanOrEqual(2)
  })

  it('찾은 자리에서 맞는 프로필이 이긴다', () => {
    const band = bandWith(B)
    const spot = calibrate(band, BW, BH, [pA, pB], 1)
    const scored = scoreProfiles(band, BW, BH, [pA, pB], spot, 1)
    expect(scored[0].id).toBe('B')
    expect(decide(scored)).toEqual({ id: 'B', score: scored[0].score })
  })

  it('닉네임 판이 없으면 못 찾았다고 한다', () => {
    const noise = toGray(make(BW, BH, (x, y) => [80 + ((x * 3) % 50), 60 + ((y * 5) % 40), 100 + ((x * y) % 30)]))
    const spot = calibrate(noise, BW, BH, [pA, pB], 1)
    expect(spot === null || spot.score < NAMEPLATE.accept).toBe(true)
  })
})

describe('decide', () => {
  it('확실한 1등이면 채택한다', () => {
    expect(decide([{ id: 'A', score: 0.97, pw: 76 }, { id: 'B', score: 0.64, pw: 76 }]))
      .toEqual({ id: 'A', score: 0.97 })
  })

  it('아무도 통과선을 못 넘으면 보류한다 (지금 프로필 유지)', () => {
    expect(decide([{ id: 'A', score: 0.7, pw: 76 }, { id: 'B', score: 0.6, pw: 76 }])).toBeNull()
  })

  it('같은 폭끼리 붙어 있으면 보류한다', () => {
    // 이름이 비슷하면 마진이 0.18까지 좁아진다(실측) — 통과선만으로는 못 가린다
    expect(decide([{ id: 'A', score: 0.90, pw: 76 }, { id: 'B', score: 0.88, pw: 76 }])).toBeNull()
  })

  it('접두 함정 — 짧은 이름이 긴 이름 안에서 만점이어도 긴 쪽을 고른다', () => {
    /*
     * "비머"(폭 37)는 "비머비숍" 화면에서 0.998이 나온다(실측). 점수만 보면 짧은 쪽이 이긴다.
     * 반대 방향은 저절로 막힌다 — 짧은 이름 화면에서 긴 프로필은 0.578.
     */
    expect(decide([
      { id: '비머', score: 0.998, pw: 37 },
      { id: '비머비숍', score: 0.987, pw: 76 },
    ])).toEqual({ id: '비머비숍', score: 0.987 })
  })

  it('빈 목록이면 보류', () => {
    expect(decide([])).toBeNull()
  })
})

describe('searchBand', () => {
  it('게임 화면 바닥만 알면 띠가 잡히고, 왼쪽은 통째로 준다', () => {
    // 왼쪽 끝은 못 믿는 값이라 입력에서 뺐다 — calibrate가 가로 전체를 훑는다
    const b = searchBand(1920, 1080, 1080, 1.40625)
    expect(b.x).toBe(0)
    expect(b.w).toBe(1920)
    expect(b.y).toBeLessThan(1080 - NAMEPLATE.anchorY * 1.40625)
    expect(b.y + b.h).toBeGreaterThan(1080 - NAMEPLATE.anchorY * 1.40625)
  })

  it('레터박스가 있으면 그 바닥을 따른다', () => {
    const full = searchBand(1920, 1080, 1080, 1.40625)
    const boxed = searchBand(1920, 1080, 902, 1.086)
    expect(boxed.y).toBeLessThan(full.y)
  })
})

describe('상수 안전선', () => {
  it('통과선이 부재 상한보다 넉넉히 위에 있다', () => {
    // 로그인·캐릭터 선택 화면 실측 최고 0.105
    expect(NAMEPLATE.accept).toBeGreaterThan(NAMEPLATE.absent + 0.3)
  })

  it('통과선이 실측 같은 닉 하한(0.892)보다 아래다', () => {
    // 확장 UI 교차 실측 최저 0.892 — 이보다 높이면 다른 배율에서 못 잡는다
    expect(NAMEPLATE.accept).toBeLessThan(0.892)
  })
})
