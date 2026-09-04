/**
 * 동작 반복 방지(동꼽) 감지 — 계산부. DOM을 쓰지 않는다.
 *
 * 제자리에서 같은 스킬을 계속 쓰면 어느 순간부터 모션만 나가고 스킬이 안 나간다.
 * 캐릭터를 조금 움직이면 풀리는데, 화면을 안 보고 있으면 걸린 줄도 모르고
 * 몹이 안 잡힌 채로 시간이 흘러간다.
 *
 * 판정은 **화면 맨 아래 가운데 경험치 숫자가 멈췄는지**로 한다.
 * 걸리면 몹이 안 죽으니 경험치가 완전히 멈춘다 — 신호가 아주 깨끗하다.
 *
 * 숫자를 읽지는 않는다. 얼마인지는 알 필요가 없고 "바뀌었는가"만 보면 되므로,
 * 그 줄의 **흰 글자 양을 세로로 합친 1차원 프로파일**을 프레임끼리 비교한다.
 * 숫자 템플릿이 필요 없어 오독이 아예 없고, 자릿수가 늘어 글자가 좌우로
 * 밀려도 프로파일이 통째로 달라지므로 그대로 '변함'으로 잡힌다.
 *
 * 흰색만 남기는 이유: 경험치가 차오르면 글자 뒤가 **노란 게이지**로 바뀌는데,
 * 노랑은 파랑 성분이 거의 없어 min(R,G,B)로 걸러진다. 실측(96% 프레임)에서도
 * 어두운 배경일 때와 똑같이 갈렸다.
 *
 * 실측 (프레임 38장, 1080p·900p·720p·640p 축소본까지):
 *   경험치가 오른 프레임 쌍의 상대차 0.176 이상, 잡음(σ=4)일 때 0.13 이하.
 *   판정선 0.10이면 양쪽 모두 여유 있게 갈린다.
 */

export const EXP_STALL = {
  /** 1초에 한 번이면 충분하다 — 젠이 7.5초라 더 자주 볼 이유가 없다 */
  scanIntervalMs: 1000,
  /**
   * 글자 줄이 들어갈 띠. 1080p 실측으로 글자는 y 1067~1076(= 바닥에서 4~13px),
   * x는 화면 정중앙 기준 848~1073이다. 해상도 오차를 감안해 넉넉히 잡는다.
   */
  /*
   * 게임 창을 못 찾았을 때만 쓰는 캡처 기준 값 (xFrom~xTo, bottomFrom~bottomTo).
   * halfWidth 는 게임 창을 찾았을 때 가운데에서 좌우로 얼마나 볼지 — 게임 폭의 비율이다.
   * 글자 자체는 게임 폭의 0.12 정도라(실측 234px / 1920px) 0.165 면 넉넉히 덮는다.
   */
  band: { xFrom: 0.35, xTo: 0.68, bottomFrom: 16, bottomTo: 2, halfWidth: 0.165 },
  /** 흰 글자로 칠 최소 밝기 — 이 아래는 배경으로 보고 버린다 */
  whiteFloor: 110,
  /** 프로파일 상대차가 이보다 크면 '경험치가 올랐다' */
  changeThreshold: 0.10,
  /**
   * 정체를 모르는 그림이 **연속 이만큼의 스캔** 동안 그대로여야 새 화면으로 받아들인다.
   * 띠 위를 스쳐 가는 것들 — 획득 문구·데미지 숫자·마우스 커서·이펙트 — 은
   * 이보다 짧게 지나가므로 멈춤 시계를 건드리지 못한다.
   *
   * 벽시계가 아니라 스캔 횟수로 센다. 백그라운드 탭이 눌리면 스캔 간격이 몇 십 초로
   * 늘어나는데, 시간으로 세면 3초 조건이 한 번의 스캔으로 무너져 가림이 바로 새 기준이 된다.
   */
  settleScans: 3,
  /**
   * 두 스캔 사이가 이만큼 벌어지면 그 구간은 없던 것으로 본다.
   * 절전에서 깨어나거나 탭이 얼었다 풀리면 Date.now() 가 몇 분씩 건너뛴다 —
   * 그대로 두면 "603초째 멈춤"이 되어 그 자리에서 헛알림이 난다.
   * 그동안 화면에 무슨 일이 있었는지는 알 수 없으므로 멈춤 시계를 다시 세운다.
   */
  maxGapMs: 5000,
  /**
   * 밀어둔 직전 그림을 이만큼까지만 붙잡고 있는다.
   * 가림은 길어야 몇 분이다. 더 오래 들고 있으면 한참 전의 경험치 값이 우연히
   * 다시 나타났을 때 그때의 시계를 되살려 "300초째 멈춤" 같은 엉뚱한 값이 된다.
   */
  stashMaxMs: 300000,
  /**
   * 띠 한 칸당 평균 흰 정도가 이보다 낮으면 글자가 없는 것으로 본다.
   * 경험치 표시를 꺼둔 경우(퍼센트만 표시)나 띠가 엉뚱한 곳을 보는 경우다.
   * 실측: 글자 있을 때 5.2~10.3, 배경만 있을 때 0~3.0.
   */
  textFloor: 1.0,
}

/**
 * 띠의 픽셀 좌표.
 *
 * game 을 주면 **게임 창 기준**으로 잡는다. 캡처 기준으로 잡으면 확장 해상도에서
 * 통째로 빗나간다 — 게임 아래가 검은 여백이라 경험치 줄은 캡처 바닥이 아니라
 * 그보다 178px 위에 있다(실측: 캡처 1920×1080, 경험치 바 y=892, 예전 띠 y=1064~1078,
 * 그 자리의 흰 정도 0.00 = 글자 없음). 그래서 확장 해상도에서는 동꼽 알림이 아예 안 돌았다.
 *
 * 경험치 글자는 **게임 창 한가운데**에 놓인다 (실측: 일반 해상도에서 글자 843~1077,
 * 가운데 960 = 게임 가운데. 확장에서도 게임 가운데 1187에 맞는다).
 * 세로는 경험치 바 줄에 걸친다 — 바 위로 UI 4px, 아래로 UI 10px 안에 들어온다
 * (실측 배율 1.401 에서 -4~+12, 1.174 에서 -1~+8).
 *
 * @param game { left, right, top } — top 은 경험치 바 줄. 없으면 캡처 기준으로 물러선다
 */
export function stallBand(vw, vh, game) {
  if (game && game.right > game.left && game.top > 0) {
    const s = (game.top + 10) / 768
    const gw = game.right - game.left
    const cx = (game.left + game.right) / 2
    const half = Math.max(20, Math.round(gw * EXP_STALL.band.halfWidth))
    const x0 = Math.max(0, Math.round(cx - half))
    const x1 = Math.min(vw, Math.round(cx + half))
    const y0 = Math.max(0, game.top - Math.round(4 * s))
    const y1 = Math.min(vh, game.top + Math.round(10 * s))
    if (x1 - x0 >= 20 && y1 - y0 >= 6) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }
  const { xFrom, xTo, bottomFrom, bottomTo } = EXP_STALL.band
  const s = vh / 1080
  const y0 = Math.max(0, vh - Math.round(bottomFrom * s))
  const y1 = Math.max(y0 + 1, vh - Math.round(bottomTo * s))
  const x0 = Math.round(vw * xFrom)
  const x1 = Math.max(x0 + 1, Math.round(vw * xTo))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * 띠 이미지 → 열별 '흰 정도' 합계.
 *
 * min(R,G,B)를 쓰면 흰색만 크게 남는다 — 노란 게이지도, 어두운 배경도 함께 떨어진다.
 * 세로로 합치는 건 잡음을 눌러주기 위해서다(14줄 평균 효과).
 */
export function whiteProfile(data, w, h) {
  const out = new Float32Array(w)
  const floor = EXP_STALL.whiteFloor
  for (let y = 0; y < h; y++) {
    let i = y * w * 4
    for (let x = 0; x < w; x++, i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const min = r < g ? (r < b ? r : b) : (g < b ? g : b)
      if (min > floor) out[x] += min - floor
    }
  }
  return out
}

/** 프로파일 전체 세기 — 글자가 있는지 판단하는 데 쓴다 */
export function profileStrength(profile, w, h) {
  let sum = 0
  for (let i = 0; i < profile.length; i++) sum += profile[i]
  return sum / Math.max(1, w * h)
}

/**
 * 두 프로파일이 얼마나 다른가 (0 = 똑같음).
 * 합으로 나눠서 해상도·밝기 차이에 휘둘리지 않게 한다.
 */
export function profileDiff(a, b) {
  if (!a || !b || a.length !== b.length) return 1
  let diff = 0
  let sa = 0
  let sb = 0
  for (let i = 0; i < a.length; i++) {
    diff += Math.abs(a[i] - b[i])
    sa += a[i]
    sb += b[i]
  }
  const base = Math.max(sa, sb, 1)
  return diff / base
}

/**
 * 멈춘 지 얼마나 됐을 때 알릴지.
 *
 * 걸린 상태는 캐릭터를 움직여야 풀리므로 한 번 울리고 끝내면 그 순간 자리를 비운
 * 사람은 그대로 놓친다. 그래서 풀릴 때까지 다시 울릴 수 있게 해둔다.
 *
 * @param stillMs      마지막으로 경험치가 오른 뒤 지난 시간
 * @param limitMs      판정 시간
 * @param sinceAlertMs 마지막 알림 뒤 지난 시간 (아직 안 울렸으면 null)
 * @param repeatMs     반복 간격. 0이나 null이면 처음 한 번만 울린다
 */
export function shouldAlert(stillMs, limitMs, sinceAlertMs, repeatMs) {
  if (stillMs < limitMs) return false
  if (sinceAlertMs == null) return true
  if (!repeatMs) return false
  return sinceAlertMs >= repeatMs
}

/* ── 멈춤 시계 ─────────────────────────────────────────────────────── */

/**
 * 멈춤 시계의 처음 상태.
 *
 * anchor  지금 경험치 줄이라고 보는 그림. **직전 프레임이 아니다.**
 * anchorAt 그 그림이 처음 나타난 시각 = 멈춤 시계의 출발점
 * alertAt null 이면 이번 멈춤에 대해 아직 안 울렸다
 * armed   한 번이라도 그림이 달라지는 걸 봤다 (= 여기가 정말 경험치 줄이다)
 * stash   돌아갈 자리. 가림이 걷혀 되돌아오면 이걸로 복원한다
 * cand    아직 정체를 모르는 그림과 그게 처음 나타난 시각
 * stable  지금 기준이 '자리를 잡은' 그림인가 — 같은 그림이 연속 몇 번 이어져서 채택됐으면 참.
 *         매 스캔 갈아엎히는 와중에 스쳐 지나간 그림이면 거짓이고, 그런 건 돌아갈 자리가 못 된다
 */
export function initialStall() {
  return {
    anchor: null, anchorAt: 0, alertAt: null, armed: false,
    stash: null, cand: null, candAt: 0, candN: 0, lastAt: 0, stable: true,
  }
}

/**
 * 멈춤 시계를 한 칸 굴린다. DOM 을 안 써서 그대로 테스트할 수 있다.
 *
 * ── 왜 직전 프레임이 아니라 기준 그림과 비교하는가 ──────────────────
 * 무언가가 경험치 줄을 잠깐 가렸다 치우면 그림은 **가리기 전 값으로 정확히 되돌아온다**
 * (실측: 같은 화면끼리 상대차 0.0000). 그런데 직전 프레임과 비교하면
 * 가릴 때 한 번, 치울 때 한 번, 총 두 번이 '경험치가 올랐다'로 읽힌다.
 * 그때마다 멈춤 시계가 0으로 돌아가고 '이미 울렸다'는 기록(alertAt)까지 지워져,
 * 반복 알림을 꺼 뒀는데도 소리가 다시 났다 — 사용자가 보고한 증상이다.
 * 기준 그림과 비교하면 되돌아온 순간 상대차가 0이라 '변한 적 없음'으로 이어진다.
 *
 * 가림을 그 자리에서 알아볼 방법은 없다. 한 장만 보고 가리는지 아닌지 가르려고
 * 세기·형태를 재 봤지만 진짜 경험치 상승과 겹쳤다 (실측: 경험치 상승 상대차가
 * 0.036~1.33 으로 가림의 0.63~1.03 을 통째로 덮는다. 세기도 부분 가림이 1.4 로
 * 글자 있을 때의 3.3~7.6 사이에 들어온다). 그래서 **되돌아오는지**로 가른다.
 *
 * ── 정체를 모르면 얼어붙는다 ──────────────────────────────────────
 * 기준과 다른 그림은 곧바로 받아들이지 않는다. settleMs 동안 같은 그림이 이어져야
 * 새 화면으로 인정한다. 덕분에 띠 위를 스쳐 가는 것들(획득 문구·커서·이펙트)이
 * 멈춤 시계를 계속 밀어내 **동꼽에 걸려도 안 울리던** 반대 방향 오류도 같이 막힌다.
 *
 * @param st     지금 상태 (initialStall 로 시작)
 * @param frame  { profile, strength, now }
 * @param opts   { limitMs, repeatMs } — repeatMs 0 이면 처음 한 번만
 * @returns { state, status, alert }  status.reason = ok|stall|waiting|notext|checking
 */
export function stepStall(st, frame, opts) {
  const { profile, strength, now } = frame
  const { limitMs, repeatMs } = opts

  /*
   * 스캔이 오래 끊겼다 (절전 복귀·탭 얼었다 풀림·창 최소화).
   * 그동안 화면에 무슨 일이 있었는지 모르므로 멈춤 시계를 다시 세운다 —
   * 그냥 두면 끊긴 시간이 통째로 '멈춰 있던 시간'이 되어 깨어나자마자 헛알림이 난다.
   * '이미 울렸다'는 기록은 지우지 않는다. 지우면 같은 멈춤에 소리가 또 난다.
   */
  const gap = st.lastAt ? now - st.lastAt : 0
  const jumped = st.lastAt && (gap < 0 || gap > EXP_STALL.maxGapMs)
  let base = { ...st, lastAt: now }
  if (jumped) base = { ...base, anchorAt: now, cand: null, candN: 0, stash: null }

  // 글자가 안 보이면 판정을 쉰다. **기준은 그대로 둔다** — 걷히면 이어서 봐야 한다
  if (strength < EXP_STALL.textFloor) {
    return { state: base, status: { reason: 'notext' }, alert: false }
  }

  // 첫 장은 기준만 잡는다 (비교 상대가 없을 때 profileDiff 는 1 이라 '변함'이 돼 버린다)
  if (!base.anchor) {
    return {
      state: { ...base, anchor: profile, anchorAt: now, cand: null, candN: 0, stable: true },
      status: { reason: 'waiting' },
      alert: false,
    }
  }

  /*
   * 띠 크기가 달라졌다 (창 크기·해상도 변경). 옛 기준과는 길이가 달라 비교 자체가 안 된다.
   * 경험치가 올랐다는 증거는 없으므로 **시계와 알림 기록은 그대로 두고** 그림만 새로 잡는다.
   * 예전에는 이 경우 profileDiff 가 1 을 돌려줘 '경험치가 올랐다'로 읽혔다.
   */
  if (base.anchor.length !== profile.length) {
    return {
      state: { ...base, anchor: profile, stash: null, cand: null, candN: 0, stable: true },
      status: { reason: 'waiting' },
      alert: false,
    }
  }

  const same = (a, b) => a && a.length === b.length && profileDiff(a, b) <= EXP_STALL.changeThreshold
  const stashFresh = base.stash && now - base.stash.stashedAt <= EXP_STALL.stashMaxMs

  /**
   * 새 화면을 받아들인다. 돌아올 자리를 stash 에 남긴다 — 이게 가림이었다면 곧 되돌아온다.
   *
   * 밀어두는 건 **자리를 잡았던 그림**뿐이고(stable), 이미 밀어둔 것보다 **더 오래
   * 자리를 지켰을 때**만 갈아끼운다. 창이 경험치 줄을 천천히 지나가면 매 초 다른 그림이 되고
   * 그 사이 가림이 잠깐 자리를 잡기도 하는데, 그때마다 stash 를 덮으면 정작 돌아가야 할
   * 원래 화면이 밀려난다 — 실측에서 밝은 창이 2~8초에 걸쳐 지나가자 걷힌 뒤 소리가 다시 났다.
   */
  const take = (at, stable) => {
    let stash = stashFresh ? base.stash : null
    if (base.stable) {
      // 더 오래 자리를 지킨 쪽이 돌아갈 자리다 — 창이 지나가는 동안 잠깐 자리잡은 가림에
      // 원래 화면이 밀려나면 안 된다(실측: 밝은 창이 8초에 걸쳐 지나가자 재알림)
      const heldMs = now - base.anchorAt
      if (!stash || heldMs >= stash.heldMs) {
        stash = { anchor: base.anchor, anchorAt: base.anchorAt, alertAt: base.alertAt, stashedAt: now, heldMs }
      }
    }
    return { ...base, stash, anchor: profile, anchorAt: at, alertAt: null, armed: true, stable, cand: null, candN: 0 }
  }

  let next = base
  if (same(base.anchor, profile)) {
    // 기준 그대로 — 경험치가 안 움직였다
    if (base.cand) next = { ...base, cand: null, candN: 0 }
  } else {
    // 한 번이라도 달라진 걸 봤다 = 안 변하는 자리(작업표시줄 등)가 아니다
    next = base.armed ? base : { ...base, armed: true }

    if (stashFresh && same(next.stash.anchor, profile)) {
      // 가림이 걷혀 그 전 그림으로 되돌아왔다 — 시계도 알림 기록도 되살린다
      const back = next.stash
      next = { ...next, anchor: back.anchor, anchorAt: back.anchorAt, alertAt: back.alertAt, stash: null, cand: null, candN: 0, stable: true }
    } else if (same(next.cand, profile)) {
      /*
       * 같은 그림이 이어진다. 연속 settleScans 번을 채우면 새 화면으로 받아들인다.
       * 시계는 그 그림이 **처음 나타난 시각**부터 센다 (기다린 만큼을 손해 보지 않게).
       */
      const candN = next.candN + 1
      if (candN < EXP_STALL.settleScans) {
        return { state: { ...next, candN }, status: checking(next, now), alert: false }
      }
      next = take(next.candAt, true)      // 연속으로 이어져 자리를 잡았다
      return { state: next, status: { reason: 'ok', stillSec: 0 }, alert: false }
    } else if (next.cand) {
      /*
       * 후보가 또 다른 그림으로 바뀌었다 = 그림이 매 스캔 갈아엎히고 있다.
       * 가림은 이렇게 계속 변하지 않는다 — **경험치가 오르는 중**이라는 뜻이다.
       * 여기서 기다리면 정상 사냥 내내 '확인 중'에 머물고 기준이 옛날 그림에 박힌다
       * (실측: 실제 사냥 40초 중 33초가 확인 중이었다).
       */
      next = take(now, false)             // 스쳐 가는 중 — 돌아갈 자리는 못 된다
      return { state: next, status: { reason: 'ok', stillSec: 0 }, alert: false }
    } else {
      // 처음 보는 그림 — 정체를 알 때까지 얼어붙는다
      return { state: { ...next, cand: profile, candAt: now, candN: 1 }, status: checking(next, now), alert: false }
    }
  }

  if (!next.armed) return { state: next, status: { reason: 'waiting' }, alert: false }

  const stillMs = now - next.anchorAt
  const stalled = stillMs >= limitMs
  const status = { reason: stalled ? 'stall' : 'ok', stillSec: Math.floor(stillMs / 1000) }
  if (!stalled) return { state: next, status, alert: false }

  const sinceAlertMs = next.alertAt == null ? null : now - next.alertAt
  if (!shouldAlert(stillMs, limitMs, sinceAlertMs, repeatMs)) return { state: next, status, alert: false }
  return { state: { ...next, alertAt: now }, status, alert: true, stillSec: Math.floor(stillMs / 1000) }
}

/**
 * 정체를 모르는 동안의 상태. 멈춤 시계는 계속 돌고 있으므로 그 값을 같이 실어 보낸다.
 * 이 상태는 길어야 연속 두 스캔이다 — 같은 그림이 이어지면 굳어서 받아들여지고,
 * 다른 그림으로 바뀌면 그림이 갈아엎히는 중(= 경험치가 오르는 중)이라 바로 받아들인다.
 */
function checking(st, now) {
  return { reason: 'checking', stillSec: st.anchorAt ? Math.floor((now - st.anchorAt) / 1000) : null }
}
