/**
 * 룬 등장 감지 — **미니맵 표식** 쪽 계산부. DOM을 쓰지 않아 워커에서도 그대로 돌아간다.
 *
 * 화면 상단 문구(runeCore.js)와 별개의 신호다. 둘 다 쓰는 이유는 서로의 약점이
 * 정확히 다르기 때문이다 (실측 영상 4편·69분·룬 6회):
 *   - 문구는 다른 UI 창에 **가려진다**. 실제로 6차 전직 창이 문구를 덮은 프레임이 있었다.
 *   - 미니맵 표식은 룬이 **플레이어 발밑에 뜨면** 내 마커에 덮인다(6회 중 1회).
 * 한쪽이 막히는 상황에서 다른 쪽은 멀쩡했다.
 *
 * 표식 쪽이 가진 장점은 **지속 시간**이다. 문구는 4~5초 뒤 사라지지만 표식은
 * 룬을 먹을 때까지 남는다 — 자리를 비운 사이에 문구가 지나가도 표식은 그대로다.
 */

import { buildIntegral, findMatches, normalize } from './locateCore'

export const MARK = {
  /**
   * 마름모 판정 통과선.
   * 실측(영상 4편, 미니맵 안): 룬 0.748~1.000 / 룬 아닌 프레임 최고 0.622.
   */
  threshold: 0.70,
  /**
   * 창 한가운데가 **실제로** 자홍인지 (min(R,B)−G 평균).
   *
   * 정규화 상호상관은 값의 크기를 지운다 — "가운데가 튀고 흰 테두리가 있고 배경이 낮은"
   * 모양은 **다른 플레이어의 빨간·분홍 마커**도 똑같아서 0.79까지 올라왔다(실측).
   * 절대 색으로 한 번 더 봐야 갈린다: 룬 92~122 / 분홍 마커 75 / 빨간 마커 20.
   */
  coreFloor: 80,
  /** 평탄한 창 제외 — 정규화 상관이 미세 잡음에 폭주하는 것을 막는다 */
  minVariance: 25,
  /** 표식은 몇 초씩 떠 있다 — 이 주기면 충분히 걸린다 */
  scanIntervalMs: 2000,
  /**
   * 한 번 알린 뒤 다시 안 알릴 시간.
   *
   * 표식은 **룬을 먹을 때까지 남는다**. 억제가 없으면 스캔마다(2초) 계속 울린다 —
   * 실제로 이 값이 빠져 있어 억제 시각이 NaN이 됐고, 그러면 어떤 비교도 false라
   * 억제가 통째로 무력화된다.
   * 룬 주기가 최소 10분이라 90초면 다음 룬을 놓칠 일은 없다(문구 쪽과 같은 값).
   */
  suppressMs: 90000,
  /**
   * 같은 자리에서 연달아 두 번 봐야 인정한다.
   * 통과선과 오탐 최고점 사이가 0.08밖에 안 되는데, 표식은 **가만히** 있고
   * 이펙트성 오탐은 한 프레임 스치므로 이 조건이 값싸게 여유를 벌어 준다.
   * (실측 룬 지속 4~10초 — 2초 간격으로 두 번 보는 데 지장이 없다)
   */
  repeatWithinPx: 4,

  /* ── 미니맵 자리 찾기 ────────────────────────────────── */
  /**
   * 앵커는 미니맵 헤더의 **홈+지도 아이콘 쌍**이다.
   *
   * 처음에는 왼쪽 위 ⊖⊕ 버튼을 썼는데, 미니맵 패널이 **반투명**이라 뒤 배경에 따라
   * 색이 통째로 달라져(파랑/갈색) 점수가 떨어지고 배경 그라데이션에 졌다 —
   * 영상 5편 중 2편에서 화면 구석의 엉뚱한 자리를 잡았다. 아이콘 쌍은 글리프
   * 대비가 뚜렷해 5편 모두 0.85~0.98로 정확히 잡혔다.
   */
  anchorScore: 0.72,
  /** 앵커 창의 최소 밝기 분산 — 흐릿한 배경이 0.86까지 올라왔다(정답 창은 1280+) */
  anchorMinVariance: 500,
  /** 앵커를 훑을 배율 (템플릿은 1080p 캡처에서 떴다) */
  anchorScales: [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4],
  /** 지도 영역 테두리로 볼 최소 밝기 — 실측 테두리 220 안팎, 패널 안쪽은 60 이하 */
  borderBright: 150,
}

/**
 * RGBA → 자홍 성분 min(R,B) − G.
 *
 * 아이콘 탐색이 쓰는 (R+B)/2 − G 로는 **빨간 플레이어 마커**와 안 갈렸다.
 * 빨강은 파랑이 거의 없으므로 min을 쓰면 빨강만 떨어진다 —
 * 룬 표식(228,119,255) → 109, 빨간 마커(230,40,60) → 20.
 */
export function toMagenta(data, out) {
  const n = data.length / 4
  const v = out || new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const r = data[p]
    const b = data[p + 2]
    v[i] = (r < b ? r : b) - data[p + 1]
  }
  return v
}

/** RGBA → 밝기 */
export function toLuma(data, out) {
  const n = data.length / 4
  const v = out || new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    v[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return v
}

/* ── 지도 영역 잡기 ──────────────────────────────────────── */

/** pos를 지나는 연속 구간의 [길이, 시작, 끝] */
function runAt(row, pos) {
  if (pos < 0 || pos >= row.length || !row[pos]) return [0, 0, -1]
  let a = pos
  while (a > 0 && row[a - 1]) a--
  let b = pos
  while (b < row.length - 1 && row[b + 1]) b++
  return [b - a + 1, a, b]
}

/**
 * 앵커(아이콘 쌍)의 자리·배율에서 미니맵 **지도 영역**을 잡아낸다.
 *
 * 지도 영역은 밝은 라운드 사각 테두리로 둘러싸여 있다(실측 밝기 220 안팎, 두께 2px).
 * 패널 자체는 반투명이라 색이 변하지만 이 테두리는 항상 밝다.
 *
 * 테두리 행은 **앵커의 x를 지나는** 구간으로만 인정한다. 아이콘 행은 패널 안에 있고
 * 지도 영역은 패널 너비를 거의 다 쓰므로 앵커 x는 늘 지도 영역의 가로 범위 안이다.
 * 이 조건이 없으면 옆에 떠 있는 다른 창의 테두리를 잡는다 — 확장 UI 영상에서
 * 이벤트 미니게임 창을 잡아 x0이 462 대신 24로 나왔다(실측).
 *
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function mapAreaFrom(luma, w, h, ax, ay, scale) {
  const x0 = Math.max(0, Math.round(ax - 760 * scale))
  const x1 = Math.min(w, Math.round(ax + 140 * scale))
  const y0 = Math.max(0, Math.round(ay + 30 * scale))
  const y1 = Math.min(h, Math.round(ay + 420 * scale))
  if (x1 - x0 < 40 || y1 - y0 < 30) return null

  const bw = x1 - x0
  const col = ax - x0
  const need = Math.round(80 * scale)
  const rows = []
  const row = new Uint8Array(bw)
  const spans = new Map()
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < bw; x++) row[x] = luma[y * w + x0 + x] > MARK.borderBright ? 1 : 0
    const [len, a, b] = runAt(row, col)
    if (len >= need) { rows.push(y); spans.set(y, [a, b]) }
  }
  if (rows.length < 2) return null

  const top = rows[0]
  let bot = -1
  for (const y of rows) {
    if (y - top >= 20 * scale && y - top <= 400 * scale) bot = y
  }
  if (bot < 0) return null

  const [a, b] = spans.get(top) ?? spans.get(bot)
  const pad = Math.max(2, Math.round(3 * scale))
  const left = x0 + a + pad
  const right = x0 + b - pad
  const tp = top + pad
  const bt = bot - pad
  if (right - left < 30 || bt - tp < 20) return null
  return { x: left, y: tp, w: right - left, h: bt - tp }
}

/* ── 미니맵 찾기 ─────────────────────────────────────────── */

/**
 * 화면에서 미니맵 지도 영역을 찾는다.
 *
 * frames.coarse / frames.full : { data(RGBA), w, h }
 * templates : [{ vecs, sizes }] — 배율별 정규화된 밝기 벡터 (coarse/full 각각)
 * @returns {{box:{x,y,w,h}, scale:number, score:number}|null}
 */
export function locateMinimap({ coarse, full, anchors, ratio }) {
  const cGray = toLuma(coarse.data)
  const cInt = buildIntegral(cGray, coarse.w, coarse.h)
  const fGray = toLuma(full.data)
  const fInt = buildIntegral(fGray, full.w, full.h)

  let best = null
  for (const a of anchors) {
    if (!a.coarseVec) continue
    const hit = findMatches(cGray, coarse.w, coarse.h, cInt, a.coarseVec, a.cw, a.ch, {
      step: 2, minScore: MARK.anchorScore - 0.15, minVariance: MARK.anchorMinVariance,
    })[0]
    if (!hit) continue
    if (!best || hit.score > best.score) best = { score: hit.score, x: hit.x, y: hit.y, tpl: a }
  }
  if (!best) return null

  // 원본 해상도에서 정련
  const a = best.tpl
  const cx = Math.round(best.x / ratio)
  const cy = Math.round(best.y / ratio)
  const pad = Math.max(6, Math.ceil(2 / ratio) + 2)
  const fine = findMatches(fGray, full.w, full.h, fInt, a.vec, a.w, a.h, {
    step: 1, minScore: -1, minVariance: MARK.anchorMinVariance,
    bounds: { x0: cx - pad, y0: cy - pad, x1: cx + pad, y1: cy + pad },
  })[0]
  if (!fine || fine.score < MARK.anchorScore) return null

  const box = mapAreaFrom(fGray, full.w, full.h, fine.x, fine.y, a.scale)
  return box ? { box, scale: a.scale, score: fine.score } : null
}

/* ── 표식 찾기 ───────────────────────────────────────────── */

/** 창 한가운데의 자홍 정도 평균 — 모양이 맞아도 색이 아니면 버린다 */
function coreMean(plane, w, x, y, size) {
  const k = Math.max(3, Math.round(size * 0.35))
  const ox = x + Math.floor((size - k) / 2)
  const oy = y + Math.floor((size - k) / 2)
  let sum = 0
  for (let j = 0; j < k; j++) {
    const row = (oy + j) * w + ox
    for (let i = 0; i < k; i++) sum += plane[row + i]
  }
  return sum / (k * k)
}

/**
 * 지도 영역 안에서 룬 표식(자홍 마름모)을 찾는다.
 *
 * band : { data(RGBA), w, h } — 지도 영역만 잘라낸 조각
 * marks: [{ magVec, lumaVec, size }] — 배율별 템플릿
 * @returns {{score:number,x:number,y:number,size:number}|null}
 */
export function scanRuneMark({ data, w, h }, marks) {
  const mag = toMagenta(data)
  const magInt = buildIntegral(mag, w, h)
  const lum = toLuma(data)
  const lumInt = buildIntegral(lum, w, h)

  let best = null
  for (const m of marks) {
    if (m.size > w || m.size > h) continue
    /*
     * 자홍 평면으로 자리를 추리고, 그 자리에서 밝기를 함께 채점한다.
     * 자홍만 보면 맵 배경의 자주색 꽃·수정과 안 갈렸다(실측 룬 0.75~0.99 / 무관 0.97).
     * 표식은 **흰 테두리**를 둘러 밝기 쪽 모양이 확실히 다르다.
     */
    for (const c of findMatches(mag, w, h, magInt, m.magVec, m.size, m.size, {
      step: 1, minScore: MARK.threshold - 0.25, minVariance: MARK.minVariance,
    }).slice(0, 8)) {
      if (coreMean(mag, w, c.x, c.y, m.size) < MARK.coreFloor) continue
      const lm = findMatches(lum, w, h, lumInt, m.lumaVec, m.size, m.size, {
        step: 1, minScore: -1, minVariance: 1,
        bounds: { x0: c.x, y0: c.y, x1: c.x, y1: c.y },
      })[0]
      const score = (c.score + (lm?.score ?? 0)) / 2
      if (!best || score > best.score) best = { score, x: c.x, y: c.y, size: m.size }
    }
  }
  return best
}

/** 정규화 벡터 만들기 (템플릿 준비용) */
export function markVec(data, plane) {
  return normalize(plane(data))
}
