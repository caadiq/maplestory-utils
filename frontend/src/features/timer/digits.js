/**
 * 쿨타임 숫자 읽기.
 *
 * 숫자를 읽으면 게임 내부 시계에 타이머를 맞출 수 있다 —
 * "54에서 53으로 바뀐 순간"은 정확한 1초 경계이고, 그때 값이 53이면
 * 쿨타임 종료는 그 순간 + 53초로 확정된다. 화면 공유 지연이나
 * 아이콘이 어두워지기까지의 시차와 무관하게 매 사이클 스스로 맞는다.
 *
 * 서체 원본은 없다. 아이콘 한 칸을 쿨타임 내내 찍은 영상 두 개(2560×1440, 1920×1080)에서
 * 정답을 알고 있는 상태로 자릿수 모양을 뽑아 평균 냈다.
 * 해상도마다 글자를 다시 그리기 때문에 한쪽만으로 배우면 다른 쪽에서 무너진다 —
 * 1440p만으로 배운 템플릿은 1080p에서 정확도가 73%까지 떨어졌다.
 */

/**
 * 잘라낸 영역이 아이콘만일 수도, 슬롯 칸 전체일 수도 있어서 고정 비율로 자르면 어긋난다.
 * 대신 영역 전체에서 금색을 찾은 뒤, 글자 높이로 걸러낸다 —
 * 우하단 개수 표시는 쿨타임 숫자보다 확연히 작다. (좌상단 단축키 글자는 흰색이라 애초에 안 걸린다)
 */
const MIN_HEIGHT_RATIO = 0.6

/**
 * 이 확신도에 못 미치면 아예 읽지 않은 것으로 친다.
 * 30fps라 1초에 여러 번 읽으므로 몇 장 버려도 손해가 없고,
 * 잘못된 값을 넘기는 것보다 안전하다. (실측에서 오독은 63~65%, 정상은 85% 이상)
 */
const MIN_CONFIDENCE = 0.72

/**
 * 1등과 2등의 점수 차이가 이만큼은 나야 믿는다.
 * 절대 점수만 보면 애매한 판정도 통과한다 — 실측에서 오독의 대부분이
 * "2등과 한두 칸 차이로 이긴" 경우였다.
 */
const MIN_MARGIN = 0.02

/** 숫자는 아무리 좁아도 키의 이 비율보다는 넓다 — 테두리 조각을 걸러내는 기준 */
const MIN_ASPECT = 0.25

/** 정규화 크기 — 가로를 늘이지 않고 비율을 지켜야 좁은 1이 4와 안 헷갈린다 */
const NW = 10
const NH = 14

const TEMPLATES = {
  0: [
    '0011111100',
    '1111111110',
    '1111001110',
    '1110001111',
    '1100000111',
    '1100000111',
    '1100000111',
    '1100000111',
    '1100000111',
    '1100001110',
    '1110001111',
    '1111011110',
    '1111111110',
    '0111111100',
  ],
  1: [
    '0001111100',
    '0011111100',
    '0011111100',
    '0011111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111100',
    '0000111000',
  ],
  2: [
    '0011111000',
    '0111111100',
    '0000001110',
    '0000001110',
    '0000000110',
    '0000001110',
    '0000011110',
    '0000111100',
    '0000111100',
    '0001111000',
    '0011110000',
    '0111110000',
    '1111111100',
    '1111111110',
  ],
  3: [
    '0111111000',
    '0111111110',
    '0000011110',
    '0000001110',
    '0000001110',
    '0000011110',
    '0011111110',
    '0011111110',
    '0000111110',
    '0000001110',
    '0000001110',
    '0000011110',
    '0111111110',
    '1111111100',
  ],
  4: [
    '0000111100',
    '0001111100',
    '0001111100',
    '0001111100',
    '0001111100',
    '0011111100',
    '0111111100',
    '0111111100',
    '1111111110',
    '1111111110',
    '1111111110',
    '0000111110',
    '0000001100',
    '0000001100',
  ],
  5: [
    '0111111110',
    '0111111110',
    '0111000000',
    '0110000000',
    '0110000000',
    '0111100000',
    '0111111100',
    '0111111110',
    '0111111110',
    '0000001110',
    '0000001110',
    '0000011110',
    '0111111110',
    '0111111100',
  ],
  6: [
    '0001111100',
    '0111111110',
    '1111000000',
    '1110000000',
    '1100000000',
    '1110000000',
    '1111111100',
    '1111111110',
    '1111111110',
    '1100001110',
    '1110001110',
    '1111011110',
    '1111111110',
    '0111111100',
  ],
  7: [
    '1111111110',
    '1111111110',
    '0000001110',
    '0000001110',
    '0000001100',
    '0000011100',
    '0000111100',
    '0000111000',
    '0001111000',
    '0001111000',
    '0011110000',
    '0011100000',
    '0111100000',
    '0011100000',
  ],
  8: [
    '0011111100',
    '1111111110',
    '1100001110',
    '1100001111',
    '1100000110',
    '1111111110',
    '1111111110',
    '1111111110',
    '1111111110',
    '1110001110',
    '1110001110',
    '1111011110',
    '1111111110',
    '0111111100',
  ],
  9: [
    '0011111100',
    '1111111110',
    '1111001111',
    '1110001111',
    '1100000111',
    '1100001111',
    '1111111111',
    '1111111111',
    '0011111111',
    '0000001111',
    '0000001110',
    '0000011110',
    '1111111110',
    '1111111100',
  ],
}

const TEMPLATE_BITS = Object.entries(TEMPLATES).map(([digit, rows]) => {
  const bits = rows.flatMap((r) => [...r].map((c) => (c === '1' ? 1 : 0)))
  return { digit, bits }
})

/**
 * 금색 픽셀인지. 쿨타임 숫자는 금색이라 밝기로 자르는 것보다 훨씬 또렷하게 갈린다
 * (아이콘 위에는 흰색 단축키 글자도 얹혀 있어 밝기로는 구분이 안 된다).
 */
function isGold(r, g, b) {
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  return mx - mn >= 45 && r >= 120 && g >= 100 && b <= 140 && r > b * 1.3 && g > b * 1.15
}

/**
 * 영역 전체에서 금색 마스크를 만든다.
 *
 * 슬롯 테두리도 금색이라 그대로 두면 숫자와 한 덩어리가 된다.
 * 테두리는 줄을 거의 다 채우는 반면 숫자는 그렇지 않으므로, 많이 채워진 줄은 지운다.
 * (고정 비율로 안쪽을 잘라내는 방법은 영역이 아이콘만일 때와 칸 전체일 때가 달라 어긋난다)
 */
function goldMask(data, w, h) {
  if (w < 8 || w * h * 4 > data.length) return null
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    mask[i] = isGold(data[p], data[p + 1], data[p + 2]) ? 1 : 0
  }

  const FULL = 0.6
  for (let y = 0; y < h; y++) {
    let n = 0
    for (let x = 0; x < w; x++) n += mask[y * w + x]
    if (n > w * FULL) for (let x = 0; x < w; x++) mask[y * w + x] = 0
  }
  for (let x = 0; x < w; x++) {
    let n = 0
    for (let y = 0; y < h; y++) n += mask[y * w + x]
    if (n > h * FULL) for (let y = 0; y < h; y++) mask[y * w + x] = 0
  }
  return { mask, w, h }
}

/**
 * 서로 이어진 픽셀 덩어리를 찾아 자릿수로 나눈다.
 *
 * 열이 비었는지로만 자르면, 테두리 모서리에 남은 위아래 부스러기가 한 덩어리로 이어져
 * 숫자보다 커 보인다. 덩어리 단위로 봐야 그런 것들을 키로 걸러낼 수 있다.
 */
function splitDigits({ mask, w, h }) {
  const label = new Int32Array(w * h).fill(-1)
  const boxes = []
  const stack = []

  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i] >= 0) continue
    const id = boxes.length
    const box = { x: i % w, y: (i / w) | 0, x2: i % w, y2: (i / w) | 0, n: 0 }
    stack.push(i)
    label[i] = id
    while (stack.length) {
      const p = stack.pop()
      const px = p % w
      const py = (p / w) | 0
      box.n++
      if (px < box.x) box.x = px
      if (px > box.x2) box.x2 = px
      if (py < box.y) box.y = py
      if (py > box.y2) box.y2 = py
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx
          const ny = py + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (mask[q] && label[q] < 0) { label[q] = id; stack.push(q) }
        }
      }
    }
    boxes.push(box)
  }
  if (boxes.length === 0) return []

  /*
   * 쿨타임 숫자만 남긴다 — 개수 표시나 테두리 부스러기는 확연히 작다.
   *
   * 키만 보면 부족하다. 아이콘이 작을수록 슬롯 테두리가 세로로 길게 살아남는데,
   * 폭 1px짜리 그 조각이 숫자 "1"로 읽혀 46이 461이 된 적이 있다.
   * 숫자는 아무리 좁아도(1) 키의 4분의 1보다는 넓고, 영역 가장자리에 붙지 않는다.
   */
  const tallest = Math.max(...boxes.map((b) => b.y2 - b.y + 1))
  const kept = boxes
    .filter((b) => {
      const bh = b.y2 - b.y + 1
      const bw = b.x2 - b.x + 1
      if (bh < tallest * MIN_HEIGHT_RATIO || b.n < 4) return false
      if (bw < 2 || bw < bh * MIN_ASPECT) return false
      return b.x > 0 && b.x2 < w - 1
    })
    .sort((a, b) => a.x - b.x)

  // 한 글자가 두 덩어리로 끊겼을 수 있으니 가로로 겹치면 합친다
  const merged = []
  for (const b of kept) {
    const prev = merged[merged.length - 1]
    if (prev && b.x <= prev.x2) {
      prev.x2 = Math.max(prev.x2, b.x2)
      prev.y = Math.min(prev.y, b.y)
      prev.y2 = Math.max(prev.y2, b.y2)
    } else merged.push({ ...b })
  }
  return merged.map((b) => ({ x: b.x, y: b.y, w: b.x2 - b.x + 1, h: b.y2 - b.y + 1 }))
}

/**
 * 자른 조각을 NW×NH로 — 세로만 맞추고 가로는 비율을 지켜 가운데 놓는다.
 *
 * 값을 하나씩 집어오면 크기를 키울 때 같은 줄이 두 번 들어가 획이 어긋난다
 * (13→14로 늘릴 때 실제로 7이 2로 읽혔다). 이웃 네 점을 섞어 부드럽게 옮긴다.
 */
function normalize({ mask, w }, box) {
  const cov = new Float32Array(NW * NH)
  const tw = Math.max(1, Math.min(NW, Math.round((box.w * NH) / box.h)))
  const off = Math.floor((NW - tw) / 2)

  const at = (x, y) => {
    const cx = Math.max(0, Math.min(box.w - 1, x))
    const cy = Math.max(0, Math.min(box.h - 1, y))
    return mask[(box.y + cy) * w + box.x + cx]
  }

  for (let y = 0; y < NH; y++) {
    const fy = ((y + 0.5) * box.h) / NH - 0.5
    const y0 = Math.floor(fy)
    const wy = fy - y0
    for (let x = 0; x < tw; x++) {
      const fx = ((x + 0.5) * box.w) / tw - 0.5
      const x0 = Math.floor(fx)
      const wx = fx - x0
      const v = at(x0, y0) * (1 - wx) * (1 - wy)
        + at(x0 + 1, y0) * wx * (1 - wy)
        + at(x0, y0 + 1) * (1 - wx) * wy
        + at(x0 + 1, y0 + 1) * wx * wy
      cov[y * NW + off + x] = v >= 0.43 ? 1 : 0
    }
  }
  return cov
}

/*
 * 겹치는 칸 수로 비교한다.
 * 커버리지를 그대로 두고 상관계수로 재보기도 했는데, 오독은 사라졌지만
 * 못 읽는 경우가 훨씬 늘어(52px 51→37) 결과적으로 손해였다.
 */
function classify(bits) {
  let best = null
  let bestScore = -1
  let second = -1
  for (const t of TEMPLATE_BITS) {
    let same = 0
    for (let i = 0; i < bits.length; i++) if (bits[i] === t.bits[i]) same++
    if (same > bestScore) { second = bestScore; bestScore = same; best = t.digit }
    else if (same > second) second = same
  }
  const n = NW * NH
  return { digit: best, score: bestScore / n, margin: (bestScore - second) / n }
}

/**
 * 셀 이미지를 살펴 쿨타임 숫자를 찾는다.
 *
 * `digits`는 값을 못 읽었어도 "쿨타임 숫자가 떠 있다"는 사실만 알려준다.
 * 이게 설치인지 아닌지를 가르는 결정적 근거다 — 밝기로는 구분이 안 된다.
 * 맵을 이동할 때 화면이 잠깐 흐려지면 아이콘도 같이 어두워지는데,
 * 밝은 점 비율로 보면 단축키 글자가 살아남아 그대로 통과해 버렸다
 * (실측: 밝기 60%로 흐려진 아이콘이 밝은점비 0.22 — 통과선 0.02의 열 배).
 * 금색 숫자 덩어리는 어떤 밝기로 흐려져도 0개, 쿨타임 중에는 항상 1~2개다.
 */
export function inspectCooldown(data, w, h) {
  const m = goldMask(data, w, h)
  if (!m) return { digits: 0, reading: null }
  const boxes = splitDigits(m)
  // 쿨타임은 아무리 길어도 두 자리다 — 셋이 나왔다면 숫자가 아닌 게 섞인 것
  if (boxes.length === 0 || boxes.length > 2) return { digits: boxes.length, reading: null }

  let text = ''
  let worst = 1
  for (const box of boxes) {
    const { digit, score, margin } = classify(normalize(m, box))
    if (digit == null || margin < MIN_MARGIN) return { digits: boxes.length, reading: null }
    text += digit
    worst = Math.min(worst, score)
  }
  const value = Number(text)
  if (worst < MIN_CONFIDENCE || !Number.isFinite(value) || value <= 0) {
    return { digits: boxes.length, reading: null }
  }
  return { digits: boxes.length, reading: { value, confidence: worst } }
}

export function readCooldown(data, w, h) {
  return inspectCooldown(data, w, h).reading
}

/* ── 읽은 값으로 타이머 맞추기 ────────────────────────────── */

/**
 * 숫자가 바뀌는 순간은 게임 내부 시계의 정확한 1초 경계다.
 * 그 순간 값이 N이면 쿨타임 종료는 "그 순간 + N초"로 확정된다.
 * 총 쿨타임을 알면 설치 시각이 나오고, 총 쿨타임은 설치 직후 처음 보이는 값이 곧 그것이다.
 *
 * 한두 번 잘못 읽어도 타이머가 튀지 않도록, 1초에 하나씩 줄어든다는 규칙에서
 * 벗어난 값은 버린다.
 */
export function createCooldownTracker(lockAfter = 3, maxShiftMs = 500, agreeMs = 130) {
  let last = null       // { value, at } — 값이 바뀐 마지막 순간
  let shift = null      // 감지로 잡은 설치 시각을 얼마나 밀어야 하는지 (ms)
  let streak = 0

  return {
    reset() { last = null; shift = null; streak = 0 },
    get shiftMs() { return shift },
    /**
     * 연속으로 몇 번 같은 값이 나오면 더 읽지 않는다.
     * 매 값을 다 맞힐 필요가 없다 — 몇 초만 이어서 읽으면 보정은 끝난다.
     */
    get locked() { return streak >= lockAfter },

    /**
     * 한 프레임 분의 읽은 값. 설치 시각이 새로 정해지면 그 값을 돌려준다.
     *
     * 읽은 숫자로 설치 시각을 직접 계산하지 않는다 — 그러려면 쿨타임 총 길이를 알아야 하는데,
     * 56초로 가정했다가 실제가 달라 알림이 통째로 1초 빨랐다. 쿨감 장비에 따라 달라지는 값이라
     * 애초에 고정할 수 없다.
     *
     * 대신 "숫자가 바뀌는 순간은 설치 시각과 정확히 1초 간격"이라는 사실만 쓴다.
     * 이러면 총 길이를 몰라도 되고, 감지가 놓친 1초 미만의 오차만 정확히 걷어낸다.
     */
    push(reading, now, rawInstallAt) {
      if (!reading || rawInstallAt == null) return null
      const { value } = reading

      // 첫 읽기는 그 값이 언제 표시되기 시작했는지 알 수 없어 기준이 못 된다
      if (!last) { last = { value, at: now }; return null }
      if (value === last.value) return null

      // 1초에 하나씩 줄어드는 규칙에서 벗어나면 잘못 읽은 것으로 보고 버린다
      const expected = last.value - Math.round((now - last.at) / 1000)
      if (value !== expected) { last = null; streak = 0; return null }

      last = { value, at: now }

      // 설치 시각과의 간격에서 1초 단위를 걷어낸 나머지 = 감지가 어긋난 만큼
      const rem = ((now - rawInstallAt) % 1000 + 1000) % 1000
      const next = rem > 500 ? rem - 1000 : rem
      if (Math.abs(next) > maxShiftMs) { streak = 0; return null }
      if (shift != null && Math.abs(next - shift) > agreeMs) { shift = next; streak = 1; return null }

      shift = shift == null ? next : Math.round(shift * 0.5 + next * 0.5)
      streak++
      return rawInstallAt + shift
    },
  }
}
