import { describe, it, expect, beforeEach } from 'vitest'
import { joinElapsedMs, saveCooldownSec, loadCooldownSec, durationForLevel } from '../logic'

/*
 * 쿨타임 도중에 화면 공유를 시작한 경우.
 *
 * 설치 판별은 "숫자가 위로 점프"만 보므로, 쿨타임이 이미 돌고 있으면 다음 설치까지
 * (새벽 30레벨이면 최대 2분) 타이머가 아예 안 돌았다. 남은 숫자로 설치 시각을 역산한다.
 */
describe('joinElapsedMs', () => {
  const TOTAL = 56

  it('숫자가 바뀌는 순간에 경과 시간을 돌려준다', () => {
    // 40 → 39 로 바뀌었다 = 남은 시간이 정확히 39초 = 설치한 지 17초
    expect(joinElapsedMs({ v: 40, t: 1000 }, 39, 2000, TOTAL)).toBe(17000)
  })

  it('아직 안 바뀌었으면 기다린다', () => {
    expect(joinElapsedMs({ v: 40, t: 1000 }, 40, 1500, TOTAL)).toBeNull()
  })

  it('두 칸 이상 건너뛴 값은 오독으로 본다', () => {
    // 이펙트에 가려 한 칸 놓쳤을 수 있지만, 그러면 순간을 못 잡은 것이라 다음 기회를 기다린다
    expect(joinElapsedMs({ v: 40, t: 1000 }, 38, 2000, TOTAL)).toBeNull()
  })

  it('1초 간격에서 벗어나면 버린다', () => {
    expect(joinElapsedMs({ v: 40, t: 1000 }, 39, 1300, TOTAL)).toBeNull()  // 너무 빠름
    expect(joinElapsedMs({ v: 40, t: 1000 }, 39, 3000, TOTAL)).toBeNull()  // 너무 느림
  })

  it('총 길이를 아직 모르면 잇지 않는다', () => {
    // 쿨타임 총 길이는 쿨감 장비에 따라 사람마다 다르다 — 추측하지 않는다
    expect(joinElapsedMs({ v: 40, t: 1000 }, 39, 2000, null)).toBeNull()
  })

  it('총 길이보다 큰 값은 버린다 (다른 스킬을 읽은 경우)', () => {
    expect(joinElapsedMs({ v: 90, t: 1000 }, 89, 2000, TOTAL)).toBeNull()
  })

  it('쿨타임이 거의 끝나가도 이어붙인다', () => {
    expect(joinElapsedMs({ v: 2, t: 1000 }, 1, 2000, TOTAL)).toBe(55000)
  })

  /*
   * 지속시간이 쿨타임보다 긴 레벨(20·30)에서는 이어붙인 뒤에도 알림이 남는다.
   * 짧은 레벨에서는 이미 지났을 수 있고, 그때는 예약 자체가 안 걸린다(scheduleFor).
   */
  it('30레벨이면 이어붙인 뒤에도 알림 시각이 넉넉히 남는다', () => {
    const elapsed = joinElapsedMs({ v: 40, t: 1000 }, 39, 2000, TOTAL)
    const remainSec = durationForLevel(30) - elapsed / 1000
    expect(remainSec).toBe(103)
  })
})

describe('쿨타임 총 길이 기억', () => {
  // 테스트 환경엔 localStorage가 없다 — 저장/읽기만 확인하면 되므로 최소한으로 흉내낸다
  beforeEach(() => {
    const box = new Map()
    globalThis.localStorage = {
      getItem: (k) => (box.has(k) ? box.get(k) : null),
      setItem: (k, v) => box.set(k, String(v)),
      removeItem: (k) => box.delete(k),
      clear: () => box.clear(),
    }
  })

  it('저장하고 다시 읽는다', () => {
    saveCooldownSec(56)
    expect(loadCooldownSec()).toBe(56)
  })

  it('있을 법하지 않은 값은 저장하지 않는다', () => {
    saveCooldownSec(3)
    expect(loadCooldownSec()).toBeNull()
    saveCooldownSec(999)
    expect(loadCooldownSec()).toBeNull()
  })

  it('아직 배운 적 없으면 null', () => {
    expect(loadCooldownSec()).toBeNull()
  })
})
