/**
 * 화면에서 아이콘 자리를 찾는 계산부. DOM을 쓰지 않아 워커에서도 그대로 돌아간다.
 *
 * 찾을 때는 밝기가 아니라 자주색 성분을 본다 — 퀵슬롯 아이콘 위에는 단축키 글자가
 * 흰색·노란색으로 얹혀 밝기 분포를 망가뜨린다. 실측하면 밝기로는 0.16~0.33(잡음 수준),
 * 자주색 성분으로는 0.65~0.78이 나온다.
 */

export const LOCATE = {
  /** 1단계로 훑을 때 줄이는 화면 가로 크기 */
  frameWidth: 640,
  /** 1단계 통과선 — 놓치는 것보다 후보가 조금 많은 편이 낫다 */
  coarseScore: 0.4,
  /** 1단계에서 2단계로 넘길 후보 수 */
  coarseKeep: 12,
  /** 2단계에서 후보 주변을 살펴볼 반경(px) */
  refineRadius: 8,
  /** 후보로 남길 최소 점수 */
  looseScore: 0.42,
  /** 겹침이 이 비율을 넘으면 같은 것으로 보고 하나만 남긴다 */
  iouThreshold: 0.3,
  /** 최대 후보 수 */
  maxCandidates: 6,
  /**
   * 아이콘 후보로 볼 최소 chroma 분산.
   * 하늘·풀밭처럼 평탄한 영역은 분산이 한 자릿수~20인데, 정규화 상관은 분산 크기를
   * 지워버려 그 미세 잡음이 77~82%짜리 가짜 후보로 올라온다(실사용 스크린샷).
   * 실측: 야누스 아이콘 198(원본)·181(축소본) — 쿨타임에 어두워질 여유를 두고 25.
   */
  minVariance: 25,

  /* 직접 지정해 저장해둔 모양으로 찾은 경우 — 사용자 화면의 실물이라 1등을 믿어도 된다 */
  sureScore: 0.5,
  sureMargin: 0.08,
  /** 이 점수 이상이면 격차와 무관하게 그 그룹을 믿는다 — 사실상 원본과 동일한 일치 */
  dominantScore: 0.85,
  /*
   * 내장 원본으로 찾은 경우 — 게임에서 그려지는 모습과 달라 1등이 정답이 아닐 수 있다.
   * (실측: 1등 0.87이 엉뚱한 자리, 정답은 0.71로 6등이었다)
   */
  builtinSureScore: 0.88,
  builtinSureMargin: 0.18,
}

/**
 * 메이플 UI 배율.
 *
 * 해상도별 스크린샷 6종을 실측해서 얻은 규칙이다. UI는 세로 768px을 기준으로
 * 그 비율만큼 커진다 (720처럼 더 작은 경우는 축소하지 않고 1배 유지).
 *
 *   해상도      배율    아이콘   우하단 기준 위치
 *   1024x768   1.000    32px    (175, 45)
 *   1280x720   1.000    32px    (175, 45)
 *   1366x768   1.000    32px    (175, 45)
 *   1920x1080  1.406    46px    (246, 64)
 *   1920x1200  1.563    50px    (274, 70)
 *   2560x1440  1.875    60px    (328, 84)
 *
 * 전체화면으로 확대돼도 같은 식이 성립한다 — 화면째 늘어나므로 캡처 세로 크기로
 * 계산하면 그대로 맞는다. 창모드라 제목 표시줄이 섞여도 오차는 몇 px뿐이다.
 */
export function uiScale(videoHeight) {
  return Math.max(1, videoHeight / 768)
}

/**
 * 퀵슬롯 상자 — 화면 우하단에 붙어 있다.
 * 기준 해상도에서 바가 차지하는 크기(600×110)를 배율만큼 키운다.
 * 여기서 아무것도 못 찾을 때만 화면 전체로 넓힌다 (막다른 길이 되지 않게 두는 안전장치).
 */
export function quickslotBox(w, h) {
  const s = uiScale(h)
  const bw = Math.min(w, Math.round(600 * s))
  const bh = Math.min(h, Math.round(110 * s))
  return { x0: w - bw, y0: h - bh, x1: w, y1: h }
}

/**
 * 훑어볼 아이콘 크기(px).
 *
 * 예전에는 세로 크기로 계산한 예측 배율 근처(±3px)만 봤는데, 인게임 **확장 UI**가
 * 그 가정을 깼다 — 창을 늘려도 게임 UI는 창 크기를 따라가지 않아서, 실측으로
 * 890px 창에서 아이콘이 30px(예측은 37px)로 나와 예측 근처에는 아예 없었다.
 * 그래서 기본 크기(32px) 언저리부터 비례 예측까지 전 구간을 1px 단위로 훑는다.
 * locate는 지정·공유 시작 때 한 번 도는 계산이라 느는 비용은 문제되지 않는다.
 */
export function candidateSizes(videoWidth, videoHeight) {
  // 실측이 예측보다 1px 크게 나온 해상도가 있어(1080p: 예측 45 / 실측 46) 위로도 여유를 둔다
  const base = Math.round(32 * uiScale(videoHeight))
  const lo = Math.min(26, base - 2) // 26 = 기본 32px에서 창 테두리 오차만큼 아래
  const sizes = []
  for (let n = lo; n <= base + 3; n++) sizes.push(n)
  return sizes.filter((n) => n >= 10)
}

/**
 * 1단계로 훑을 대표 크기.
 * 성긴 단계는 크기가 20%쯤 달라도 걸리므로, 이웃 간 비율이 1.18을 넘지 않게 고른다.
 * (예전엔 처음·중간·끝 셋이었는데, 크기 범위가 넓어지면서 셋으로는 사이가 빈다)
 */
export function probeSizes(sizes) {
  if (sizes.length <= 3) return sizes
  const out = [sizes[0]]
  let prev = sizes[0]
  for (const s of sizes) {
    // s에서 처음 1.18배를 넘게 되면, 넘기 직전 크기가 마지막 안전 지점이다
    if (s > out[out.length - 1] * 1.18) out.push(prev)
    prev = s
  }
  const last = sizes[sizes.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

/* ── 픽셀 → 특징값 ───────────────────────────────────────── */

/** RGBA 배열 → 자주색 성분 (R+B)/2 − G */
export function toChroma(data, out) {
  const n = data.length / 4
  const v = out || new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    v[i] = (data[p] + data[p + 2]) / 2 - data[p + 1]
  }
  return v
}

/** 평균 0, 길이 1로 정규화 — 두 벡터의 내적이 곧 정규화 상호상관이 된다 */
export function normalize(v) {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i]
  const mean = sum / v.length
  let norm = 0
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] - mean
    norm += out[i] * out[i]
  }
  norm = Math.sqrt(norm)
  if (norm < 1e-6) return null
  for (let i = 0; i < out.length; i++) out[i] /= norm
  return out
}

/* ── 적분 영상 ────────────────────────────────────────────── */

/**
 * 값과 제곱값의 누적합. 창의 평균·분산을 창 크기와 무관하게 상수 시간에 구한다.
 * 창마다 픽셀을 전부 더하던 것을 대체 — 큰 화면을 여러 크기로 훑을 때 차이가 크다.
 */
export function buildIntegral(gray, w, h) {
  const iw = w + 1
  const s1 = new Float64Array(iw * (h + 1))
  const s2 = new Float64Array(iw * (h + 1))
  for (let y = 0; y < h; y++) {
    let row1 = 0
    let row2 = 0
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x]
      row1 += v
      row2 += v * v
      s1[(y + 1) * iw + (x + 1)] = s1[y * iw + (x + 1)] + row1
      s2[(y + 1) * iw + (x + 1)] = s2[y * iw + (x + 1)] + row2
    }
  }
  return { s1, s2, iw }
}

function boxSum(s, iw, x, y, w, h) {
  const x1 = x + w
  const y1 = y + h
  return s[y1 * iw + x1] - s[y * iw + x1] - s[y1 * iw + x] + s[y * iw + x]
}

/* ── 탐색 ─────────────────────────────────────────────────── */

/**
 * gray 안에서 정규화된 tpl(tw×th)과 닮은 자리를 찾는다.
 * 창의 평균·분산은 적분 영상에서 꺼내고, 상관은 템플릿 픽셀만큼만 곱한다.
 */
export function findMatches(gray, w, h, integral, tpl, tw, th, opts = {}) {
  const { step = 2, minScore = 0.5, bounds = null, minVariance = 4 } = opts
  const { s1, s2, iw } = integral
  const x0 = Math.max(0, bounds?.x0 ?? 0)
  const y0 = Math.max(0, bounds?.y0 ?? 0)
  const x1 = Math.min(w - tw, bounds?.x1 ?? w - tw)
  const y1 = Math.min(h - th, bounds?.y1 ?? h - th)

  const n = tw * th
  const invN = 1 / n
  const invSqrtN = 1 / Math.sqrt(n)
  const found = []

  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const sum = boxSum(s1, iw, x, y, tw, th)
      const mean = sum * invN
      const variance = boxSum(s2, iw, x, y, tw, th) * invN - mean * mean
      if (variance < minVariance) continue // 평탄한 창 — 아이콘일 리 없다
      const inv = invSqrtN / Math.sqrt(variance)

      let dot = 0
      for (let j = 0; j < th; j++) {
        const row = (y + j) * w + x
        const trow = j * tw
        for (let i = 0; i < tw; i++) dot += (gray[row + i] - mean) * tpl[trow + i]
      }
      const score = dot * inv
      if (score >= minScore) found.push({ x, y, score })
    }
  }

  found.sort((a, b) => b.score - a.score)
  return found
}

/* ── 후보 정리 ────────────────────────────────────────────── */

function iou(a, b) {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x) * Math.max(0, y2 - y)
  const union = a.w * a.h + b.w * b.h - inter
  return union <= 0 ? 0 : inter / union
}

/** 교집합이 작은 쪽 넓이에서 차지하는 비율 — 큰 박스 안의 작은 박스를 잡아낸다 */
function containment(a, b) {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x) * Math.max(0, y2 - y)
  return inter / Math.max(1, Math.min(a.w * a.h, b.w * b.h))
}

/**
 * 겹치는 후보를 하나로 합친다.
 * 거리로 자르면 아이콘 크기가 다를 때 어긋나서, 넓이가 얼마나 겹치는지로 본다.
 * IoU만으로는 부족하다 — 크기 범위가 넓어져 26px 후보가 48px 후보 안에 통째로
 * 들어가도 IoU 0.29라 서로 다른 것으로 남았다. 같은 자리의 다른 크기일 뿐이므로
 * 작은 쪽이 거의 포함되면(containment) 하나로 본다.
 */
export function suppressOverlaps(boxes, threshold = LOCATE.iouThreshold) {
  const kept = []
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    if (kept.some((k) => iou(box, k) > threshold || containment(box, k) > 0.5)) continue
    kept.push(box)
  }
  return kept
}

/* ── 전체 흐름 ────────────────────────────────────────────── */

/**
 * 줄인 화면에서 자리를 추리고, 원본 해상도에서 다시 확인한다.
 * 줄인 화면에서는 아이콘이 15px 남짓이라 세부가 뭉개져 그것만으로는 판정을 못 믿는다.
 *
 * frames.coarse / frames.full : { data(RGBA), w, h }
 * templates : [{ vecs: { [size]: Float32Array }, coarseVecs: { [size]: Float32Array } }]
 */
export function locateIcon({ coarse, full, templates, sizes, probes, ratio }) {
  const cGray = toChroma(coarse.data)
  const cInt = buildIntegral(cGray, coarse.w, coarse.h)
  const fGray = toChroma(full.data)
  const fInt = buildIntegral(fGray, full.w, full.h)

  /**
   * 1단계 — 주어진 범위에서 자리만 추린다.
   * 어느 크기의 성긴 훑기에 걸렸는지(sMin~sMax)도 함께 기억한다 — 크기 범위가
   * 넓어져서 2단계에서 전 크기를 다 대보면 낭비고, 걸린 크기 근처만 보면 된다.
   */
  const collectSpots = (bounds) => {
    const spots = []
    for (const tpl of templates) {
      for (const size of probes) {
        const vec = tpl.coarseVecs[size]
        if (!vec) continue
        const tw = Math.max(6, Math.round(size * ratio))
        const th = tw
        for (const hit of findMatches(cGray, coarse.w, coarse.h, cInt, vec, tw, th, {
          step: 3, minScore: LOCATE.coarseScore, bounds, minVariance: LOCATE.minVariance,
        }).slice(0, LOCATE.coarseKeep)) {
          const near = spots.find((s) => Math.abs(s.x - hit.x) < tw && Math.abs(s.y - hit.y) < th)
          if (near) {
            near.sMin = Math.min(near.sMin, size)
            near.sMax = Math.max(near.sMax, size)
            /*
             * 위치는 점수가 가장 높은 히트의 것을 쓴다. 크기가 안 맞는 훑기는
             * 아이콘 안쪽에 몇 px 어긋나게 붙는데, 먼저 왔다는 이유로 그 위치가
             * 스팟을 고정하면 정답 위치가 정련 반경 밖으로 밀린다(실측 9px).
             */
            if (hit.score > near.score) {
              near.score = hit.score
              near.x = hit.x
              near.y = hit.y
            }
            continue
          }
          spots.push({ ...hit, sMin: size, sMax: size })
        }
      }
    }
    return spots
  }

  // 퀵슬롯 상자 → 하단 전체 → 화면 전체 순으로 넓혀 가며 찾는다.
  // 상자는 원본 해상도 기준으로 잡고 축소 화면 좌표로 옮긴다 (축소본으로 계산하면 엉뚱하게 커진다)
  const boxFull = quickslotBox(full.w, full.h)
  const box = {
    x0: Math.floor(boxFull.x0 * ratio),
    y0: Math.floor(boxFull.y0 * ratio),
    x1: Math.ceil(boxFull.x1 * ratio),
    y1: Math.ceil(boxFull.y1 * ratio),
  }
  let spots = collectSpots(box)
  // 상자에서 아무것도 못 찾았을 때만 화면 전체로 — 막다른 길이 되지 않게 두는 안전장치다
  if (spots.length === 0) spots = collectSpots({})

  // 2단계 — 후보 주변만 원본 해상도에서 촘촘히
  // 반경은 성긴 격자(step 3)의 오차를 원본 px로 환산한 값 이상이어야 한다 —
  // 화면이 넓을수록 축소비(ratio)가 작아져 같은 격자 오차가 원본에서 더 커진다
  const r = Math.max(LOCATE.refineRadius, Math.ceil(1.5 / ratio) + 2)
  const results = []
  for (const spot of spots) {
    const cx = Math.round(spot.x / ratio)
    const cy = Math.round(spot.y / ratio)
    for (const tpl of templates) {
      for (const size of sizes) {
        // 성긴 단계는 ±20%쯤 차이 나는 크기에도 걸린다 — 그 너머는 볼 이유가 없다
        if (size < spot.sMin / 1.25 || size > spot.sMax * 1.25) continue
        const vec = tpl.vecs[size]
        if (!vec) continue
        const best = findMatches(fGray, full.w, full.h, fInt, vec, size, size, {
          step: 1,
          minScore: LOCATE.looseScore,
          minVariance: LOCATE.minVariance,
          bounds: { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r },
        })[0]
        if (best) results.push({ x: best.x, y: best.y, w: size, h: size, score: best.score })
      }
    }
  }

  return suppressOverlaps(results).slice(0, LOCATE.maxCandidates)
}
