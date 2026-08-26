import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { settledFrame } from '../frameGeometry'

/**
 * 가짜 공유 화면. plan은 재는 순번대로 내놓을 값 —
 * 실제로 본 움직임(창은 멎었는데 게임이 조금씩 채움)을 흉내낸다.
 */
function fakeVideo(plan) {
  let i = 0
  const calls = []
  return {
    videoWidth: plan[0].w,
    videoHeight: plan[0].h,
    requestVideoFrameCallback: (cb) => setTimeout(cb, 16),
    measure: () => {
      const m = plan[Math.min(i, plan.length - 1)]
      calls.push(m)
      i++
      return m
    },
    calls,
  }
}

/** 정착을 기다리는 동안 가짜 시계를 넉넉히 돌린다 */
async function run(v, alive = () => true) {
  const p = settledFrame(v, alive, v.measure)
  await vi.advanceTimersByTimeAsync(20000)
  return p
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('settledFrame', () => {
  it('값이 계속 변하는 동안은 안 끝나고, 멎은 뒤에 그 값을 준다', async () => {
    /*
     * 실측(창 크기 변경 브라우저 캡처.mp4): 창이 멎은 뒤에도 게임이 오른쪽을
     * 1085→1127→1136→1160→1177로 2초에 걸쳐 채웠다. 중간에 끝내면 그만큼 밀린다.
     */
    const v = fakeVideo([
      { w: 1900, h: 1080, right: 1600, bottom: 900 },
      { w: 1900, h: 1080, right: 1700, bottom: 900 },
      { w: 1900, h: 1080, right: 1800, bottom: 900 },
      ...Array.from({ length: 10 }, () => ({ w: 1900, h: 1080, right: 1900, bottom: 900 })),
    ])
    expect(await run(v)).toEqual({ w: 1900, h: 1080, right: 1900, bottom: 900 })
  })

  it('1~2px 흔들림은 멎은 것으로 본다', async () => {
    const v = fakeVideo(Array.from({ length: 12 }, (_, k) => (
      { w: 1600, h: 900, right: 1600, bottom: 898 + (k % 3) }
    )))
    const got = await run(v)
    expect(got.w).toBe(1600)
    expect(v.calls.length).toBeLessThan(12)   // 흔들림 때문에 끝까지 가지 않는다
  })

  it('중간에 다른 변경이 끼어들면 그만둔다', async () => {
    const v = fakeVideo([{ w: 1600, h: 900, right: 1600, bottom: 900 }])
    let n = 0
    expect(await run(v, () => ++n < 3)).toBeNull()
  })

  it('모서리를 못 재면 기다리지 않고 바로 돌려준다', async () => {
    const v = fakeVideo([{ w: 1600, h: 900 }])
    expect(await run(v)).toEqual({ w: 1600, h: 900 })
    expect(v.calls.length).toBe(1)
  })

  it('끝까지 안 멎으면 마지막으로 잰 값이라도 준다', async () => {
    const v = fakeVideo(Array.from({ length: 40 }, (_, k) => (
      { w: 1600, h: 900, right: 1500 + k * 10, bottom: 900 }
    )))
    const got = await run(v)
    expect(got).not.toBeNull()
    expect(got.right).toBeGreaterThan(1500)
  })
})
