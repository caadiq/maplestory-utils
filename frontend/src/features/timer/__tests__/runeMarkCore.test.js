import { describe, it, expect } from 'vitest'
import { MARK, toMagenta, toLuma, mapAreaFrom, scanRuneMark } from '../runeMarkCore'
import { normalize } from '../locateCore'

/** RGBA 이미지를 만든다. paint(x, y) → [r,g,b] */
function make(w, h, paint) {
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

const DARK = [24, 52, 60]        // 미니맵 배경 (어두운 청록)
const MAGENTA = [228, 119, 255]  // 룬 표식 속살 (실측)
const RED = [230, 40, 60]        // 다른 플레이어 마커 (실측)
const WHITE = [235, 238, 242]    // 마커 테두리

/** 가운데에 '흰 테두리 두른 마름모'를 그린다 */
const diamond = (w, h, cx, cy, r, core) => (x, y) => {
  const d = Math.abs(x - cx) + Math.abs(y - cy)
  if (d <= r - 2) return core
  if (d <= r) return WHITE
  return DARK
}

describe('toMagenta', () => {
  it('자홍은 크게 남고 빨강은 떨어진다', () => {
    // (R+B)/2 − G 로는 빨강도 105가 되어 안 갈렸다 — min을 쓰는 이유
    const v = toMagenta(make(2, 1, (x) => (x === 0 ? MAGENTA : RED)))
    expect(v[0]).toBeGreaterThan(100)
    expect(v[1]).toBeLessThan(40)
  })

  it('노랑·초록처럼 파랑이 없는 색은 음수로 내려간다', () => {
    const v = toMagenta(make(2, 1, (x) => (x === 0 ? [255, 220, 50] : [60, 200, 90])))
    expect(v[0]).toBeLessThan(0)
    expect(v[1]).toBeLessThan(0)
  })
})

describe('mapAreaFrom', () => {
  /*
   * 미니맵 흉내: 위아래에 밝은 테두리, 그 사이는 어두운 지도.
   * 앵커(아이콘 쌍)는 헤더에 있으므로 지도 영역보다 위·안쪽에 있다.
   */
  const W = 400
  const H = 300
  const build = (extra = () => null) => {
    const px = make(W, H, (x, y) => {
      const e = extra(x, y)
      if (e) return e
      const inBox = x >= 40 && x <= 300
      if (inBox && (y === 100 || y === 101 || y === 200 || y === 201)) return [220, 224, 230]
      if (inBox && y > 101 && y < 200) return DARK
      return [30, 34, 40]
    })
    return toLuma(px)
  }

  it('테두리 사이를 지도 영역으로 잡는다', () => {
    const box = mapAreaFrom(build(), W, H, 200, 20, 1)
    expect(box).not.toBeNull()
    expect(box.y).toBeGreaterThanOrEqual(101)
    expect(box.y).toBeLessThanOrEqual(107)
    expect(box.x).toBeGreaterThanOrEqual(40)
    expect(box.x + box.w).toBeLessThanOrEqual(301)
    expect(box.h).toBeGreaterThan(80)
  })

  it('앵커 x를 지나지 않는 다른 창의 테두리는 무시한다', () => {
    /*
     * 확장 UI 영상에서 옆에 뜬 이벤트 미니게임 창의 테두리가 더 길어서 그쪽을 잡았다
     * (x0이 462여야 하는데 24로 나왔다). 앵커 x를 지나는 구간만 인정해야 한다.
     */
    const other = (x, y) => (x >= 0 && x <= 35 && (y === 60 || y === 260) ? [230, 230, 235] : null)
    const box = mapAreaFrom(build(other), W, H, 200, 20, 1)
    expect(box).not.toBeNull()
    expect(box.x).toBeGreaterThanOrEqual(40)
  })

  it('테두리가 없으면 못 잡았다고 한다', () => {
    const flat = toLuma(make(W, H, () => [30, 34, 40]))
    expect(mapAreaFrom(flat, W, H, 200, 20, 1)).toBeNull()
  })
})

describe('scanRuneMark', () => {
  const SIZE = 13
  const tplData = make(SIZE, SIZE, diamond(SIZE, SIZE, 6, 6, 6, MAGENTA))
  const marks = [{
    magVec: normalize(toMagenta(tplData)),
    lumaVec: normalize(toLuma(tplData)),
    size: SIZE,
  }]
  const band = (paint) => ({ data: make(120, 80, paint), w: 120, h: 80 })

  it('자홍 마름모를 찾아낸다', () => {
    const hit = scanRuneMark(band(diamond(120, 80, 60, 40, 6, MAGENTA)), marks)
    expect(hit).not.toBeNull()
    expect(hit.score).toBeGreaterThanOrEqual(MARK.threshold)
    expect(Math.abs(hit.x + SIZE / 2 - 60)).toBeLessThanOrEqual(2)
  })

  it('같은 모양이어도 빨간 마커는 걸러낸다', () => {
    /*
     * 정규화 상호상관은 값의 크기를 지운다 — "가운데가 튀고 흰 테두리가 있는" 모양은
     * 다른 플레이어 마커도 똑같아서 0.79까지 올라왔다(실측). 중심 색을 봐야 갈린다.
     */
    const hit = scanRuneMark(band(diamond(120, 80, 60, 40, 6, RED)), marks)
    expect(hit === null || hit.score < MARK.threshold).toBe(true)
  })

  it('아무것도 없으면 못 찾았다고 한다', () => {
    expect(scanRuneMark(band(() => DARK), marks)).toBeNull()
  })
})
