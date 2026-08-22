/**
 * VIP 부스터 남은시간 읽기 — 계산부. DOM을 쓰지 않아 워커에서도 그대로 돌아간다.
 *
 * 룬을 풀고 부스터를 쓰면 화면 중앙 상단에 "남은시간 97.61 초" 박스가 뜨고 100초를 센다.
 * 축복룬 지속시간(4분~4분 30초)에는 부스터를 두 번 쓰는데, 첫 번째가 끝난 걸 놓치면
 * 두 번째를 못 쓰고 룬이 끝나버린다. 그래서 0초에 도달하는 순간에 알린다.
 *
 * 판정은 두 단계다.
 *  1) "남은시간" 라벨을 NCC로 찾는다 (박스가 지금 떠 있는지 + 정확한 위치)
 *  2) 라벨 위치에서 고정 오프셋만큼 떨어진 두 칸의 숫자를 읽는다
 *
 * 숫자를 읽는 이유: 사라지는 순간만 보면 전투 이펙트나 인벤토리 창이 박스를 가릴 때
 * 그걸 '종료'로 오인한다(실측: 시작 직후 인벤토리가 1초간 가림). 남은 초를 알면
 * 그 시점에 소리를 미리 예약해두므로, 마지막 순간을 못 봐도 정시에 울린다.
 *
 * 검증: 영상 2편(다른 캐릭터·다른 맵) 각 180프레임 — 읽은 값이 전부 정답, 오독 0.
 */
import { buildIntegral, findMatches, uiScale } from './locateCore'

export const BOOSTER = {
  /** 라벨 판정 통과선 — 실측 가림 없을 때 0.98+, 가릴 때 0.23까지 떨어진다 */
  labelScore: 0.75,
  /**
   * 성긴 훑기에서 정련으로 넘길 통과선.
   *
   * 글자 템플릿은 정점에서 1px만 벗어나도 점수가 크게 깎인다 — 실측으로 정점 0.98이
   * 2px 격자에서 0.81까지 떨어졌고, 밴드 시작 좌표가 1px 달라지면 그보다 더 내려간다.
   * 그래서 성긴 단계는 후보만 추리고, 통과 여부는 1px 정련 결과로 판단한다.
   */
  coarseScore: 0.35,
  coarseKeep: 6,
  /** 숫자 한 칸의 판정 통과선. 못 미치면 그 프레임은 통째로 버린다 */
  digitScore: 0.90,
  /**
   * 작은 배율(확장 UI 등)에서의 통과선.
   * UI가 작게 그려지면 숫자가 15px대까지 줄어 NCC가 원천적으로 내려간다 —
   * 실프레임 0.652배 축소 시뮬레이션에서 정답 숫자가 0.8~0.9 사이였고
   * margin 판정은 그대로 통과했다(87을 정독). 오독 방지의 주력은 margin이다.
   */
  digitScoreSmall: 0.82,
  /** 이 절대 배율 미만이면 위 완화 통과선을 쓴다 */
  smallScaleBelow: 0.8,
  /** 1등과 2등의 차이가 이만큼은 나야 믿는다 */
  digitMargin: 0.05,
  /**
   * 라벨을 찾을 범위 — 박스는 화면 중앙 상단 고정 위치에 뜬다.
   * 실측(1080p) 라벨 좌상단은 (818, 86). 창모드 제목 표시줄과 해상도 오차를 감안해 넓게 잡았다.
   */
  band: { x0: 0.34, x1: 0.60, y0: 0.03, y1: 0.22 },
  /** 문구는 100초 내내 떠 있다 — 1초에 한 번이면 충분하고 가벼움 */
  scanIntervalMs: 1000,
  /** 부스터 최대 길이(초). 읽은 값이 이보다 크면 오독으로 본다 */
  maxSeconds: 100,
}

/**
 * 라벨 좌상단을 원점으로 한 숫자 칸 위치 (1080p 실측).
 * 라벨을 먼저 찾고 거기서 상대 위치로 자르기 때문에, 박스가 몇 px 밀려도 같이 따라간다.
 *
 * 값이 10 미만이면 십의 자리 칸은 그냥 꺼진다 — 자리가 오른쪽으로 밀리지 않는다(실측).
 */
export const DIGIT_CELLS = {
  tens: { dx: 110, dy: -4, w: 24, h: 57 },
  ones: { dx: 138, dy: -4, w: 24, h: 57 },
}

/**
 * 훑어볼 배율 후보 (예상 배율 대비 비율).
 *
 * 캡처 화면의 세로 크기로 배율을 계산하는데, 게임 창을 통째로 공유하면 제목 표시줄과
 * 테두리가 함께 들어와 실제 게임 UI보다 몇 %씩 어긋난다. 라벨은 그래도 찾아지지만
 * (실측 0.84) 숫자 칸은 몇 px만 밀려도 통째로 못 읽는다.
 * 그래서 배율을 가정하지 않고 라벨이 가장 잘 맞는 배율을 화면에서 직접 고른다.
 */
export const SCALE_STEPS = [0.88, 0.91, 0.94, 0.97, 1.0, 1.03, 1.06, 1.09, 1.12, 1.16]

/** RGBA → 밝기. 숫자도 라벨도 어두운 패널 위의 밝은 글자다 */
export function toLuma(data, out) {
  const n = data.length / 4
  const v = out || new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    v[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return v
}

/** 템플릿은 1080p 실측이다 — 현재 화면의 UI 배율로 환산한다 */
export function boosterScale(videoHeight) {
  return uiScale(videoHeight) / uiScale(1080)
}

/** 잘라낸 한 칸을 0~9 템플릿과 대조 — { digit, score, margin } */
function readCellAt(gray, w, h, cell, digits) {
  const { x, y, cw, ch } = cell
  if (x < 0 || y < 0 || x + cw > w || y + ch > h) return null

  // 평균 0, 길이 1로 맞춘 뒤 내적하면 그대로 NCC가 된다
  let sum = 0
  const buf = new Float32Array(cw * ch)
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const v = gray[(y + j) * w + (x + i)]
      buf[j * cw + i] = v
      sum += v
    }
  }
  const mean = sum / buf.length
  let norm = 0
  for (let i = 0; i < buf.length; i++) {
    buf[i] -= mean
    norm += buf[i] * buf[i]
  }
  norm = Math.sqrt(norm)
  if (norm < 1e-6) return { digit: null, score: 0, margin: 0 } // 꺼진 칸(단색)

  let best = -1
  let second = -1
  let bestDigit = null
  for (const { digit, vec } of digits) {
    if (vec.length !== buf.length) continue
    const t = vec instanceof Float32Array ? vec : new Float32Array(vec)
    let dot = 0
    for (let i = 0; i < buf.length; i++) dot += buf[i] * t[i]
    const score = dot / norm
    if (score > best) { second = best; best = score; bestDigit = digit }
    else if (score > second) second = score
  }
  return { digit: bestDigit, score: best, margin: best - Math.max(0, second) }
}

/**
 * 칸 위치를 1px씩 흔들어 가장 잘 맞는 자리를 쓴다.
 * 배율을 곱하면서 생기는 반올림 오차만으로도 글자가 한 칸 어긋나 판독이 실패한다.
 */
function readCell(gray, w, h, cell, digits) {
  let best = null
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const r = readCellAt(gray, w, h, { ...cell, x: cell.x + dx, y: cell.y + dy }, digits)
      if (!r) continue
      // 꺼진 칸(단색)은 흔들어도 계속 단색이다 — 그대로 돌려준다
      if (r.digit == null) return r
      if (!best || r.score > best.score) best = r
    }
  }
  return best
}

/**
 * band(RGBA 조각) 안에서 부스터 박스를 찾아 남은 초를 읽는다.
 *
 * label   : { vec, tw, th } — 정규화된 밝기 벡터
 * digits  : [{ digit, vec, w, h }] — 0~9, 같은 크기
 * 반환: { seconds, labelScore, x, y } | null
 */
/**
 * 판정 결과. seconds가 null이어도 어디까지 갔는지 알 수 있어야 한다 —
 * 화면에 상태로 띄워 "박스를 못 찾음"과 "찾았는데 숫자를 못 읽음"을 구분한다.
 * reason: 'ok' | 'digit'(박스는 찾았으나 숫자 실패) | 'none'(박스 못 찾음)
 */
/**
 * variants: [{ scale, label:{vec,tw,th}, digits:[{digit,vec}], cells:{tens,ones} }]
 *   — 배율 후보별 템플릿 묶음. 첫 원소가 예상 배율(1.0)이다.
 * lockedScale: 직전에 성공한 배율. 있으면 그 배율부터 본다(매번 전 배율을 훑지 않도록).
 */
export function scanBooster({ data, w, h }, variants, lockedScale = null) {
  const gray = toLuma(data)
  const integral = buildIntegral(gray, w, h)
  const vec = (v) => (v instanceof Float32Array ? v : new Float32Array(v))

  // 1단계 — 예상 배율(또는 직전에 성공한 배율)로 라벨 자리부터 찾는다.
  // 배율이 조금 어긋나도 라벨은 찾아진다(실측 0.84). 정확한 배율은 2단계에서 고른다.
  const probe = variants.find((v) => v.scale === lockedScale) || variants[0]
  const probeVec = vec(probe.label.vec)
  const coarse = findMatches(gray, w, h, integral, probeVec, probe.label.tw, probe.label.th, {
    step: 2, minScore: BOOSTER.coarseScore,
  }).slice(0, BOOSTER.coarseKeep)
  if (!coarse.length) return { seconds: null, reason: 'none', labelScore: 0 }

  let anchor = null
  for (const c of coarse) {
    const best = findMatches(gray, w, h, integral, probeVec, probe.label.tw, probe.label.th, {
      step: 1,
      minScore: BOOSTER.coarseScore,
      bounds: { x0: c.x - 2, y0: c.y - 2, x1: c.x + 2, y1: c.y + 2 },
    })[0]
    if (best && (!anchor || best.score > anchor.score)) anchor = best
  }
  if (!anchor || anchor.score < BOOSTER.labelScore) {
    return { seconds: null, reason: 'none', labelScore: anchor?.score ?? coarse[0].score }
  }

  /*
   * 2단계 — 찾은 자리 주변에서 배율 후보를 전부 대보고 가장 잘 맞는 것을 고른다.
   * 배율이 달라지면 템플릿 크기가 달라져 좌상단도 같이 움직이므로 주변을 넓게 본다.
   * 숫자 칸은 이 배율·이 자리 기준으로 잘라야 몇 px 어긋남 없이 읽힌다.
   */
  let bestFit = null
  for (const v of variants) {
    const hit = findMatches(gray, w, h, integral, vec(v.label.vec), v.label.tw, v.label.th, {
      step: 1,
      minScore: BOOSTER.coarseScore,
      bounds: { x0: anchor.x - 10, y0: anchor.y - 6, x1: anchor.x + 10, y1: anchor.y + 6 },
    })[0]
    if (hit && (!bestFit || hit.score > bestFit.score)) bestFit = { ...hit, variant: v }
  }
  if (!bestFit || bestFit.score < BOOSTER.labelScore) {
    return { seconds: null, reason: 'none', labelScore: bestFit?.score ?? anchor.score }
  }

  const v = bestFit.variant
  const at = (c) => ({ x: bestFit.x + c.dx, y: bestFit.y + c.dy, cw: c.w, ch: c.h })
  const tens = readCell(gray, w, h, at(v.cells.tens), v.digits)
  const ones = readCell(gray, w, h, at(v.cells.ones), v.digits)
  // 실패해도 숫자가 어느 수준이었는지 남긴다 — 화면 상태 표시로 원인을 볼 수 있게
  const fail = {
    seconds: null, reason: 'digit', labelScore: bestFit.score, scale: v.scale,
    digitScore: Math.max(ones?.score ?? 0, tens?.score ?? 0),
  }
  if (!ones) return fail

  // scale이 절대 배율이라(1.0 = 1080p 원본 크기) 배율에 따라 통과선을 고를 수 있다
  const floor = v.scale < BOOSTER.smallScaleBelow ? BOOSTER.digitScoreSmall : BOOSTER.digitScore
  const good = (r) => r && r.digit != null
    && r.score >= floor && r.margin >= BOOSTER.digitMargin
  if (!good(ones)) return fail

  // 십의 자리는 값이 10 미만이면 꺼진다 — 못 읽은 것과 구분해야 한다.
  // 꺼진 칸은 단색이라 digit이 null로 온다(점수 0). 반대로 뭔가 있는데 확신이 낮으면 버린다.
  let seconds
  if (tens && tens.digit == null) seconds = ones.digit
  else if (good(tens)) seconds = tens.digit * 10 + ones.digit
  else return fail

  if (seconds > BOOSTER.maxSeconds) return fail
  return { seconds, reason: 'ok', labelScore: bestFit.score, scale: v.scale, x: bestFit.x, y: bestFit.y }
}
