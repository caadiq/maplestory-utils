import { describe, it, expect } from 'vitest'
import {
  EXP_STALL, stallBand, whiteProfile, profileStrength, profileDiff, shouldAlert,
  initialStall, stepStall,
} from '../expStallCore'

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
    // 확장 UI의 중심 치우침(실측 0.60~0.62 지점) 때문에 띠가 0.35~0.68로 넓다
    expect(stallBand(1920, 1080)).toEqual({ x: 672, y: 1064, w: 634, h: 14 })
  })

  it('게임 창을 주면 그 창의 경험치 바에 맞춘다', () => {
    // 확장 해상도 실측: 캡처 1920x1080인데 게임은 x454~1920, 경험치 바가 y892
    const b = stallBand(1920, 1080, { left: 454, right: 1920, top: 892 })
    expect(b.y).toBeLessThanOrEqual(892)
    expect(b.y + b.h).toBeGreaterThan(892)
    // 글자는 게임 창 한가운데(1187)에 있다
    const cx = b.x + b.w / 2
    expect(Math.abs(cx - (454 + 1920) / 2)).toBeLessThanOrEqual(1)
  })

  it('예전처럼 캡처 바닥을 보면 확장 해상도에서 통째로 빗나간다', () => {
    // 이게 확장 해상도에서 동꼽 알림이 아예 안 돌던 이유다 (그 자리 흰 정도 0.00)
    const old = stallBand(1920, 1080)
    expect(old.y).toBeGreaterThan(1000)          // 캡처 바닥
    const fixed = stallBand(1920, 1080, { left: 454, right: 1920, top: 892 })
    expect(old.y - fixed.y).toBeGreaterThan(150) // 178px 어긋났다
  })

  it('게임 창이 없으면 예전 방식으로 물러선다', () => {
    expect(stallBand(1920, 1080, null)).toEqual(stallBand(1920, 1080))
    expect(stallBand(1920, 1080, { left: 100, right: 50, top: 900 })).toEqual(stallBand(1920, 1080))
    expect(stallBand(1920, 1080, { left: 0, right: 1920, top: 0 })).toEqual(stallBand(1920, 1080))
  })

  it('해상도가 달라도 바닥에 붙어 가운데를 본다', () => {
    const b = stallBand(2560, 1440)
    // 맨 아래 몇 px은 일부러 뺀다 (1080p 기준 2px) — 글자는 그 위에 있다
    expect(1440 - (b.y + b.h)).toBeLessThanOrEqual(4)
    expect(b.x).toBe(896)
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

describe('stepStall — 멈춤 시계', () => {
  /*
   * 프로파일은 그림 하나를 뜻하는 숫자 배열이면 된다. 실제 픽셀은 whiteProfile 이 만들지만
   * 여기서 보려는 건 "어느 그림이 언제 나타났는가"의 판단이라 그림을 직접 준다.
   * 서로 상대차가 판정선을 확실히 넘도록 겹치지 않는 자리에 세운다.
   */
  const pic = (slot, size = 10) => {
    const v = new Float32Array(size)
    v[slot % size] = 100
    return v
  }
  const TEXT = pic(0)          // 동꼽에 걸린 경험치 줄
  const RISEN = pic(1)         // 경험치가 오른 뒤
  const COVER = pic(2)         // 무언가가 가린 화면
  const COVER2 = pic(3)

  const LIMIT = 15000
  const OPTS = { limitMs: LIMIT, repeatMs: 0 }

  /** 초 단위 프레임 목록을 먹이고 알림이 울린 시각(초)을 돌려준다 */
  const run = (frames, opts = OPTS) => {
    let st = initialStall()
    const alerts = []
    const statuses = []
    frames.forEach((f, t) => {
      const profile = f === null ? new Float32Array(10) : f
      const strength = f === null ? 0 : 5   // null 이면 '글자 안 보임'
      const r = stepStall(st, { profile, strength, now: t * 1000 }, opts)
      st = r.state
      statuses.push(r.status.reason)
      if (r.alert) alerts.push(t)
    })
    return { alerts, statuses, state: st }
  }

  /** 0~2초 경험치 상승(무장) → 그 뒤 계속 TEXT 로 정지 */
  const stalledFrom3 = (n) => [pic(7), pic(8), pic(9), ...Array(n).fill(TEXT)]

  it('멈추면 한 번 울린다', () => {
    // 3초부터 정지 — 15초를 채우는 18초에 울린다
    expect(run(stalledFrom3(30)).alerts).toEqual([18])
  })

  it('안 변하는 자리(작업표시줄 등)는 영영 안 울린다', () => {
    // 첫 변화를 못 봤으면 여기가 경험치 줄인지 알 수 없다
    expect(run(Array(60).fill(TEXT)).alerts).toEqual([])
  })

  it('경험치가 계속 오르면 안 울린다', () => {
    // 경험치는 단조 증가라 같은 그림으로 되돌아오지 않는다 — 매 초 새 그림
    const frames = Array.from({ length: 60 }, (_, t) => pic(t, 80))
    expect(run(frames).alerts).toEqual([])
  })

  /* ── 보고된 버그: 가렸다 치우면 다시 울린다 ─────────────────────── */

  it('밝은 것으로 잠깐 가렸다 치워도 다시 안 울린다', () => {
    // 20~22초를 가리고 23초에 치운다. 이미 18초에 울렸으므로 그걸로 끝이어야 한다
    const frames = stalledFrom3(30)
    for (let t = 20; t < 23; t++) frames[t] = COVER
    expect(run(frames).alerts).toEqual([18])
  })

  it('어두운 것으로 가려 글자가 안 보여도 시계가 안 끊긴다', () => {
    const frames = stalledFrom3(30)
    for (let t = 20; t < 26; t++) frames[t] = null   // strength 0 = 글자 안 보임
    expect(run(frames).alerts).toEqual([18])
  })

  it('가림이 걷힌 뒤 멈춤 시계가 이어진다 (0으로 안 돌아간다)', () => {
    const frames = stalledFrom3(30)
    for (let t = 10; t < 16; t++) frames[t] = null
    // 3초부터 멈췄으니 18초에 울려야 한다. 시계가 끊겼다면 31초로 밀린다
    expect(run(frames).alerts).toEqual([18])
  })

  it('울리기 전에 가렸다 치워도 원래 시각에 울린다', () => {
    const frames = stalledFrom3(30)
    for (let t = 8; t < 12; t++) frames[t] = COVER
    expect(run(frames).alerts).toEqual([18])
  })

  it('가리는 것이 두 번 바뀌어도 되돌아오면 이어진다', () => {
    const frames = stalledFrom3(40)
    for (let t = 20; t < 24; t++) frames[t] = COVER
    for (let t = 24; t < 28; t++) frames[t] = COVER2
    expect(run(frames).alerts).toEqual([18])
  })

  /* ── 반대 방향 오류: 지나가는 것 때문에 영영 안 울리던 문제 ──────── */

  it('띠 위로 뭔가 스쳐 지나가도 멈춤 시계가 안 밀린다', () => {
    /*
     * 획득 문구·데미지 숫자·마우스 커서가 1초씩 걸치는 상황.
     * 예전에는 걸칠 때마다 lastChangeAt 이 0으로 돌아가 동꼽에 걸려도 영영 안 울렸다.
     * 지금은 스쳐 간 것으로 보고 무시하므로 원래 시각에 그대로 울린다.
     */
    const frames = stalledFrom3(40)
    for (let t = 8; t < 18; t += 3) frames[t] = pic(4 + (t % 2))
    expect(run(frames).alerts).toEqual([18])
  })

  it('기준이 자리잡기 전에 계속 깜빡이면 시계가 늦게 시작한다 (놓치지는 않는다)', () => {
    /*
     * settleMs(3초)보다 짧은 간격으로 계속 뭔가 지나가면 어느 그림이 경험치 줄인지
     * 정할 수 없다. 그동안은 checking 으로 기다리다가, 조용해지는 순간부터 시계가 선다.
     * 알림이 늦어질 뿐 사라지지는 않는다 — 예전 코드는 이 상황에서 아예 안 울렸다.
     */
    const frames = stalledFrom3(60)
    for (let t = 4; t < 16; t += 3) frames[t] = pic(4 + (t % 2))
    const { alerts } = run(frames)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toBeGreaterThan(18)
    expect(alerts[0]).toBeLessThanOrEqual(32)
  })

  it('정체를 모르는 동안은 checking 이고 알림을 참는다', () => {
    const frames = stalledFrom3(30)
    frames[10] = COVER
    const { statuses } = run(frames)
    expect(statuses[10]).toBe('checking')
    expect(statuses[11]).toBe('ok')      // 되돌아왔다
  })

  /* ── 진짜 변화는 여전히 잡는다 ──────────────────────────────── */

  it('경험치가 실제로 오르면 시계가 다시 시작한다', () => {
    const frames = stalledFrom3(50)
    for (let t = 25; t < 50; t++) frames[t] = RISEN
    // 18초에 한 번, 25초부터 다시 멈췄으니 40초에 또 한 번
    expect(run(frames).alerts).toEqual([18, 40])
  })

  it('새 화면을 받아들일 때 시계는 그게 처음 나온 시각부터 센다', () => {
    // 기다리는 3초를 손해 보면 안 된다
    const frames = stalledFrom3(50)
    for (let t = 25; t < 50; t++) frames[t] = RISEN
    const { alerts } = run(frames)
    expect(alerts[1] - 25).toBe(15)
  })

  it('가린 사이에 경험치가 실제로 올랐으면 다시 무장한다', () => {
    const frames = stalledFrom3(60)
    for (let t = 20; t < 25; t++) frames[t] = COVER
    for (let t = 25; t < 60; t++) frames[t] = RISEN
    expect(run(frames).alerts).toEqual([18, 40])
  })

  /* ── 반복 알림 ──────────────────────────────────────────── */

  it('반복을 켜면 간격대로 다시 울리고, 가림이 그 간격을 흐트러뜨리지 않는다', () => {
    const frames = stalledFrom3(60)
    for (let t = 30; t < 34; t++) frames[t] = COVER
    const plain = run(stalledFrom3(60), { limitMs: LIMIT, repeatMs: 20000 }).alerts
    const covered = run(frames, { limitMs: LIMIT, repeatMs: 20000 }).alerts
    expect(covered).toEqual(plain)
  })

  /* ── 창 크기·해상도 변경 ───────────────────────────────────── */

  it('한참 전 그림이 우연히 다시 나와도 그때 시계를 되살리지 않는다', () => {
    // 밀어둔 그림은 stashMaxMs 까지만 유효하다 — 가림은 길어야 몇 분이다
    const n = Math.ceil(EXP_STALL.stashMaxMs / 1000) + 40
    const frames = stalledFrom3(n)
    for (let t = 6; t < n; t++) frames[t] = RISEN        // 경험치가 올라 TEXT 는 밀려난다
    frames[n - 1] = TEXT                                 // 아주 나중에 우연히 같은 그림
    const { state } = run(frames)
    // 되살렸다면 시계가 3초부터가 되어 몇 백 초로 찍힌다
    expect(state.anchorAt).toBeGreaterThan(EXP_STALL.stashMaxMs / 2)
  })

  it('띠 크기가 바뀌어도 경험치가 올랐다고 보지 않는다', () => {
    // 예전에는 길이가 다르면 profileDiff 가 1 이라 '올랐다'로 읽혀 알림 기록까지 지워졌다
    const frames = stalledFrom3(30)
    const wide = new Float32Array(20)
    wide[0] = 100
    for (let t = 20; t < 30; t++) frames[t] = wide
    expect(run(frames).alerts).toEqual([18])
  })

  it('글자가 안 보이는 동안에는 기준을 버리지 않는다', () => {
    const frames = stalledFrom3(10)
    frames[8] = null
    const { state } = run(frames)
    expect(state.anchor).not.toBeNull()
  })
})
