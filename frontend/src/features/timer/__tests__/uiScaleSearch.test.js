import { describe, it, expect } from 'vitest'
import { candidateSizes, probeSizes, uiScale } from '../locateCore'
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

  it('실측이 없으면 예측 기준 ±4%를 2% 간격으로 낸다', () => {
    const c = runeScaleCandidates(1, null)
    expect(c).toEqual([0.96, 0.98, 1, 1.02, 1.04])
  })
})
