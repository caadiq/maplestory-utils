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
  // 확장 UI에서는 하단 UI 중심이 캡처 중심에서 벗어난다(실측 0.60~0.62 지점) — 좌우로 넓혀 둔다
  band: { xFrom: 0.35, xTo: 0.68, bottomFrom: 16, bottomTo: 2 },
  /** 흰 글자로 칠 최소 밝기 — 이 아래는 배경으로 보고 버린다 */
  whiteFloor: 110,
  /** 프로파일 상대차가 이보다 크면 '경험치가 올랐다' */
  changeThreshold: 0.10,
  /**
   * 띠 한 칸당 평균 흰 정도가 이보다 낮으면 글자가 없는 것으로 본다.
   * 경험치 표시를 꺼둔 경우(퍼센트만 표시)나 띠가 엉뚱한 곳을 보는 경우다.
   * 실측: 글자 있을 때 5.2~10.3, 배경만 있을 때 0~3.0.
   */
  textFloor: 1.0,
}

/** 캡처 크기에 맞춘 띠의 픽셀 좌표 */
export function stallBand(vw, vh) {
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
