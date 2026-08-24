import { describe, it, expect } from 'vitest'
import { LOCATE, candidateSizes, probeSizes, uiScale, contentBottom } from '../locateCore'
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
  const ABSENT_MAX = 0.538 // 아이콘을 지운 화면 40장의 최고점 (실측)
  const ANSWER_P1 = 0.727  // 정답 점수 하위 1% (실측 612프레임)

  it('후보 하한은 정답을 하나도 안 버린다', () => {
    // 배율이 크게 다른 화면에서는 정답도 0.57까지 내려간다 — 하한을 그 위로 올리면 안 된다
    expect(LOCATE.looseScore).toBeLessThan(0.568)
    expect(LOCATE.looseScore).toBeGreaterThan(0.42)
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
