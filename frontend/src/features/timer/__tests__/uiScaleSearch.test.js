import { describe, it, expect } from 'vitest'
import { LOCATE, candidateSizes, probeSizes, uiScale, contentBottom, contentBox, shiftRegion } from '../locateCore'
import { DETECT } from '../logic'
import { runeScaleCandidates, runeTemplateScale } from '../runeCore'
import { learnIconSize, measuredUiScale } from '../uiCalibration'

/*
 * 확장 UI 대응 — 창 크기와 게임 UI 배율이 따로 놀 수 있다.
 * 실측 사례: 2000×890 창에서 아이콘 30px (세로 비례 예측은 37px).
 */

describe('candidateSizes', () => {
  it('확장 UI의 작은 아이콘(30px)과 비례 예측(46px)을 모두 덮는다', () => {
    const s = candidateSizes(1920, 1080)
    expect(s).toContain(30)
    expect(s).toContain(46)
  })

  it('실측 사례: 890px 창의 30px 아이콘이 후보에 있다', () => {
    expect(candidateSizes(2000, 890)).toContain(30)
  })

  it('작은 화면에서도 기본 크기(32px) 언저리를 덮는다', () => {
    const s = candidateSizes(1366, 768)
    expect(s[0]).toBeLessThanOrEqual(26)
    expect(s).toContain(32)
  })
})

describe('probeSizes', () => {
  it('이웃 간 비율이 1.18을 넘지 않는다 (성긴 단계의 허용 오차 ±20% 안)', () => {
    for (const [w, h] of [[1920, 1080], [2000, 890], [2560, 1440]]) {
      const p = probeSizes(candidateSizes(w, h))
      for (let i = 1; i < p.length; i++) {
        expect(p[i] / p[i - 1]).toBeLessThanOrEqual(1.18 + 1e-9)
      }
    }
  })

  it('처음과 끝 크기를 반드시 포함한다', () => {
    const s = candidateSizes(2560, 1440)
    const p = probeSizes(s)
    expect(p[0]).toBe(s[0])
    expect(p[p.length - 1]).toBe(s[s.length - 1])
  })
})

describe('uiCalibration', () => {
  it('실측은 같은 캡처 크기에서만 유효하다', () => {
    learnIconSize(30, 2000, 890)
    expect(measuredUiScale(2000, 890)).toBeCloseTo(30 / 32)
    expect(measuredUiScale(1920, 1080)).toBeNull()
  })
})

describe('runeScaleCandidates', () => {
  it('실측이 있으면 실측 기준으로 후보를 만든다', () => {
    const c = runeScaleCandidates(runeTemplateScale(890), 30 / 32)
    const base = (30 / 32) / uiScale(1080)
    expect(Math.min(...c.map((s) => Math.abs(s - base)))).toBeLessThan(0.01)
    // 예측(0.824)과는 뚜렷이 다른 대역이어야 한다
    expect(Math.max(...c)).toBeLessThan(0.75)
  })

  it('실측이 없으면 예측과 기본 UI(1.0) 두 기준을 함께 본다', () => {
    const c = runeScaleCandidates(1, null)
    // 예측(1.0) 이웃과 기본 UI(1/1.40625 = 0.711) 이웃이 모두 있어야 한다
    expect(c).toContain(1)
    expect(Math.min(...c.map((s) => Math.abs(s - 1 / uiScale(1080))))).toBeLessThan(0.001)
  })

  it('예측과 기본 UI가 같은 화면(768p)에서는 후보가 5개로 줄어든다', () => {
    expect(runeScaleCandidates(runeTemplateScale(768), null).length).toBe(5)
  })
})

/*
 * 아이콘 판별 임계값.
 *
 * 실측: 10분 영상 2편(1080p 기본 UI / 확장 UI) 612프레임 + 아이콘을 지운 화면 40장.
 * 쿨타임 모습 48장을 템플릿에 넣은 뒤 정답과 무관한 자리가 확실히 갈렸다.
 *   정답 1위 점수   최저 0.568 / 하위 1% 0.727 / 중앙 0.829
 *   아이콘이 없을 때 최고점 0.538
 * 임계값들이 그 사이에 있어야 "없으면 조용히 넘어가고, 있으면 바로 확정"이 된다.
 */
describe('LOCATE 임계값', () => {
  const ABSENT_MAX = 0.597 // 아이콘을 지운 화면 40장의 최고점 (실측, 템플릿 74장 기준)
  const ANSWER_P1 = 0.727  // 정답 점수 하위 1% (실측 708프레임: 새벽·확장·황혼)

  it('후보 하한은 정답을 하나도 안 버린다', () => {
    // 배율이 크게 다른 화면에서는 정답도 0.568까지 내려간다 — 하한을 그 위로 올리면 안 된다
    expect(LOCATE.looseScore).toBeLessThan(0.568)
    expect(LOCATE.looseScore).toBeGreaterThan(0.42)
  })

  it('확정선은 부재 최고점과 넉넉히 떨어져 있다', () => {
    // 붙어 있으면 아이콘이 없는 화면에서 엉뚱한 자리를 자동으로 확정해 버린다
    expect(LOCATE.builtinSureScore - ABSENT_MAX).toBeGreaterThan(0.04)
    expect(LOCATE.autoSureScore - ABSENT_MAX).toBeGreaterThan(0.04)
  })

  it('자동 확정선은 부재 최고점과 정답 하위 1% 사이에 있다', () => {
    expect(LOCATE.autoSureScore).toBeGreaterThan(ABSENT_MAX)
    expect(LOCATE.autoSureScore).toBeLessThan(ANSWER_P1)
  })

  it('내장 원본 확정선도 같은 구간에 있다', () => {
    expect(LOCATE.builtinSureScore).toBeGreaterThan(ABSENT_MAX)
    expect(LOCATE.builtinSureScore).toBeLessThan(ANSWER_P1)
  })

  it('저장 실물 기준은 내장 원본보다 느슨하다', () => {
    expect(LOCATE.sureScore).toBeLessThanOrEqual(LOCATE.builtinSureScore)
  })

  it('저장 실물 기준도 부재 최고점 위에 있다', () => {
    /*
     * 여기만 빠뜨리면 저장 이력이 있는 사용자가 야누스 없는 화면에서 공유를 켰을 때
     * 엉뚱한 자리를 후보 화면도 없이 확정한다 — 실제로 났던 구멍이다.
     */
    expect(LOCATE.sureScore - ABSENT_MAX).toBeGreaterThan(0.04)
  })
})

/*
 * 게임 화면의 유효 바닥 — 해상도 확장 창을 공유하면 게임 아래에 레터박스가 깔리고
 * 그 안에 분리 채팅 같은 UI 섬이 떠다닌다. 아래에서부터 처음 만나는 밝은 행을
 * 바닥으로 삼으면 그 섬에 걸려 퀵슬롯 상자가 통째로 빗나간다(실측: 확장 영상
 * 312장 중 14장). 가장 큰 덩어리를 게임 화면으로 봐야 한다.
 */
describe('contentBottom', () => {
  /** rows(y0,y1) 구간만 밝은 화면을 만든다 */
  const make = (w, h, spans) => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (const [y0, y1] of spans) {
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          data[i] = data[i + 1] = data[i + 2] = 200
          data[i + 3] = 255
        }
      }
    }
    return data
  }

  it('레터박스가 없으면 화면 바닥 그대로', () => {
    expect(contentBottom(make(40, 100, [[0, 99]]), 40, 100)).toBe(100)
  })

  it('레터박스 안의 UI 섬에 걸리지 않는다', () => {
    // 게임 0~89 (90행) 아래에 레터박스, 그 안에 95~97 짜리 채팅창
    expect(contentBottom(make(40, 100, [[0, 89], [95, 97]]), 40, 100)).toBe(90)
  })

  it('섬이 여러 개여도 가장 큰 덩어리를 고른다', () => {
    expect(contentBottom(make(40, 100, [[0, 79], [85, 87], [92, 96]]), 40, 100)).toBe(80)
  })

  it('아무것도 밝지 않으면 화면 바닥으로 둔다', () => {
    expect(contentBottom(make(40, 100, []), 40, 100)).toBe(100)
  })
})

/*
 * 새벽/황혼 판별.
 *
 * 실측(원본 해상도 44px): 황혼 화면에서 dusk 0.864 / dawn 0.422,
 * 새벽 화면에서 dawn 0.796 / dusk 0.357. 쿨타임 중에는 둘 다 0 근처로 떨어진다.
 * 24×24로 줄여 봐도 같다 — 새벽 대기 dawn 0.823 / dusk 0.363.
 */
describe('모드 판별 기준', () => {
  it('통과선은 쿨타임 중(≈0)과 대기 상태(0.79+) 사이에 있다', () => {
    expect(LOCATE.modeScore).toBeGreaterThan(0.2)
    expect(LOCATE.modeScore).toBeLessThan(0.79)
    expect(DETECT.modeScore).toBeGreaterThan(0.2)
    expect(DETECT.modeScore).toBeLessThan(0.79)
  })

  it('격차 기준은 실측 격차(0.44)보다 넉넉히 작다', () => {
    expect(LOCATE.modeMargin).toBeLessThan(0.44)
    expect(DETECT.modeMargin).toBeLessThan(0.44)
    expect(LOCATE.modeMargin).toBeGreaterThan(0)
  })

  it('한 번의 오독으로 모드가 넘어가지 않는다', () => {
    expect(DETECT.modeVotes).toBeGreaterThanOrEqual(2)
  })
})

/*
 * 자리 후보 선별 — 쿨타임 모습을 48장 넣고 나서, 그중 한 장이 혼자 자리 8개를
 * 차지하는 바람에 황혼 아이콘이 걸린 화면에서 후보가 통째로 0개가 됐다(실측).
 */
describe('자리 후보 선별', () => {
  it('한 모양이 목록을 독식하지 못한다', () => {
    expect(LOCATE.spotPerTemplate).toBeGreaterThan(0)
    expect(LOCATE.spotPerTemplate * 2).toBeLessThan(LOCATE.spotKeep)
  })

  it('모드 원본은 자리를 여러 개 남긴다 — 놓치면 그 모드를 아예 못 쓴다', () => {
    expect(LOCATE.spotModeKeep).toBeGreaterThanOrEqual(2)
  })
})

/*
 * 창 크기가 바뀌었을 때 지정 영역이 어디로 가는가.
 *
 * 퀵슬롯은 **게임 화면** 우하단에 붙박이라, 두 경우가 정반대로 움직인다.
 * 실사용에서 둘 다 보고됐다:
 *   - 세로로 늘렸더니 게임은 그대로고 아래 여백만 생김 → 아이콘 제자리
 *   - 가로로 늘렸더니 게임이 같이 넓어짐 → 아이콘도 오른쪽으로 이동
 * 캡처 모서리 기준이면 첫째가 틀리고, 픽셀만 고정하면 둘째가 틀린다.
 */
describe('창 크기가 바뀌었을 때 영역', () => {
  const px = (r, f) => ({
    x: Math.round(r.x * f.w), y: Math.round(r.y * f.h),
    w: Math.round(r.w * f.w), h: Math.round(r.h * f.h),
  })
  /** 게임 화면 우하단에 붙은 44px 아이콘 */
  const icon = (f, right, bottom) => ({
    x: (f.right - right - 44) / f.w, y: (f.bottom - bottom - 44) / f.h,
    w: 44 / f.w, h: 44 / f.h,
  })

  it('세로로 늘렸는데 여백만 생기면 제자리에 있는다', () => {
    const base = { w: 1920, h: 1080, right: 1920, bottom: 1080 }
    const next = { w: 1920, h: 1280, right: 1920, bottom: 1080 }   // 게임 바닥 그대로
    const r = icon(base, 201, 19)                                   // (1675, 1017)
    expect(px(shiftRegion(r, base, next), next)).toEqual({ x: 1675, y: 1017, w: 44, h: 44 })
  })

  it('가로로 늘려 게임이 같이 넓어지면 아이콘도 따라간다', () => {
    const base = { w: 1920, h: 1080, right: 1920, bottom: 1080 }
    const next = { w: 2200, h: 1080, right: 2200, bottom: 1080 }
    const r = icon(base, 201, 19)
    expect(px(shiftRegion(r, base, next), next)).toEqual({ x: 1955, y: 1017, w: 44, h: 44 })
  })

  it('아이콘 크기는 px 그대로 — UI 배율은 창 크기를 안 따라간다', () => {
    const base = { w: 1920, h: 1080, right: 1920, bottom: 1080 }
    const next = { w: 2560, h: 1440, right: 2560, bottom: 1440 }
    const moved = px(shiftRegion(icon(base, 201, 19), base, next), next)
    expect(moved.w).toBe(44)
    expect(moved.h).toBe(44)
  })

  it('창이 작아져 영역이 밖으로 나가면 안쪽으로 밀어 넣는다', () => {
    const base = { w: 1920, h: 1080, right: 1920, bottom: 1080 }
    const next = { w: 800, h: 600, right: 800, bottom: 600 }
    const moved = px(shiftRegion(icon(base, 201, 19), base, next), next)
    expect(moved.x).toBeGreaterThanOrEqual(0)
    expect(moved.y + moved.h).toBeLessThanOrEqual(next.h)
  })
})

/*
 * 게임 화면이 캡처 안에서 차지하는 범위 — 퀵슬롯 검색 상자를 잡는 데 쓴다.
 * 레터박스 안에 떠 있는 작은 UI 섬(분리 채팅 등)에 걸리면 안 된다.
 */
describe('contentBox', () => {
  /** 위쪽 contentH 행만 밝은 화면. holes에 든 행은 일부러 어둡게 비운다 */
  const frame = (w, h, contentH, contentW = w, holes = []) => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < contentH; y++) {
      if (holes.includes(y)) continue
      for (let x = 0; x < contentW; x++) {
        const i = (y * w + x) * 4
        data[i] = data[i + 1] = data[i + 2] = 200
        data[i + 3] = 255
      }
    }
    return data
  }

  it('게임 화면의 우하단 모서리를 찾는다', () => {
    expect(contentBox(frame(800, 600, 480), 800, 600)).toEqual({ right: 800, bottom: 480 })
    expect(contentBox(frame(800, 600, 600, 700), 800, 600)).toEqual({ right: 700, bottom: 600 })
  })

  it('게임 화면 안의 짧은 어두운 줄은 이어 붙인다', () => {
    /*
     * 어두운 맵에서는 게임 화면 안에도 밝기가 잠깐 떨어지는 줄이 생긴다
     * (실측: 26~29%짜리 줄 7개). 그대로 두면 화면이 토막 나고 위쪽 토막이
     * '가장 큰 덩어리'로 뽑혀 퀵슬롯이 통째로 검색 범위 밖이 됐다.
     */
    const holes = [300, 301, 450, 500, 501]
    expect(contentBox(frame(800, 600, 600, 800, holes), 800, 600).bottom).toBe(600)
  })

  it('레터박스만큼 긴 틈은 이어 붙이지 않는다', () => {
    // 게임 0~399, 빈 구간 400~499(100행), 아래에 UI 섬 500~529
    const data = new Uint8ClampedArray(800 * 600 * 4)
    const fill = (y0, y1) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < 800; x++) {
          const i = (y * 800 + x) * 4
          data[i] = data[i + 1] = data[i + 2] = 200
          data[i + 3] = 255
        }
      }
    }
    fill(0, 399)
    fill(500, 529)
    expect(contentBox(data, 800, 600).bottom).toBe(400)
  })
})
