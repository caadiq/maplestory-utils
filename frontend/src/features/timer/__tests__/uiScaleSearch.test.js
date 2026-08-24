import { describe, it, expect } from 'vitest'
import { LOCATE, candidateSizes, probeSizes, uiScale } from '../locateCore'
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
 * 아이콘 판별 — 자주색만으로는 퀵슬롯의 다른 보라 계열 아이콘이 0.64~0.73까지
 * 올라와 정답(0.78~1.00)과 겹쳤다. 밝기를 함께 보면 실측 15케이스에서
 * 정답 0.678~1.000 / 무관 0.424~0.506으로 갈린다. 임계값들이 그 사이에 있어야 한다.
 */
describe('LOCATE 임계값', () => {
  const RIVAL_MAX = 0.506  // 아이콘을 지운 화면의 최고점 (실측)
  const ANSWER_MIN = 0.678 // 정답 최저 (실측, 확장 UI 쿨타임)

  it('후보 하한은 무관 후보 대부분을 걸러내되 정답은 남긴다', () => {
    expect(LOCATE.looseScore).toBeLessThan(ANSWER_MIN)
    expect(LOCATE.looseScore).toBeGreaterThan(0.42)
  })

  it('자동 확정선은 부재 최고점과 정답 최저 사이에 있다', () => {
    expect(LOCATE.autoSureScore).toBeGreaterThan(RIVAL_MAX)
    expect(LOCATE.autoSureScore).toBeLessThan(ANSWER_MIN)
  })

  it('내장 원본 확정선도 같은 구간에 있다 (예전 0.88은 새 척도에서 정답을 놓친다)', () => {
    expect(LOCATE.builtinSureScore).toBeGreaterThan(RIVAL_MAX)
    expect(LOCATE.builtinSureScore).toBeLessThan(ANSWER_MIN)
  })

  it('저장 실물 기준은 내장 원본보다 느슨하다', () => {
    expect(LOCATE.sureScore).toBeLessThanOrEqual(LOCATE.builtinSureScore)
  })
})
