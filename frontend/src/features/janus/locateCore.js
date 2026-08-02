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

  /* 직접 지정해 저장해둔 모양으로 찾은 경우 — 사용자 화면의 실물이라 1등을 믿어도 된다 */
  sureScore: 0.5,
  sureMargin: 0.08,
  /*
   * 내장 원본으로 찾은 경우 — 게임에서 그려지는 모습과 달라 1등이 정답이 아닐 수 있다.
   * (실측: 1등 0.87이 엉뚱한 자리, 정답은 0.71로 6등이었다)
   */
  builtinSureScore: 0.88,
  builtinSureMargin: 0.18,
}

/**
 * 메이플 게임 설정에 있는 해상도 전부 (창모드·전체화면 공통).
 * 캡처에는 창 테두리가 조금 섞일 수 있어서, 가장 가까운 값으로 맞춰 본다.
 */
const GAME_RESOLUTIONS = [
  [1024, 768], [1280, 720], [1366, 768],
  [1920, 1080], [1920, 1200], [2560, 1440],
]

/** 1080p 화면에서 실측한 퀵슬롯 아이콘 크기(px) */
const BASE_ICON = 40
const BASE_HEIGHT = 1080

/**
 * 훑어볼 아이콘 크기 후보(px).
 *
 * 메이플 UI는 해상도가 커져도 픽셀 크기가 그대로다. 다만 업스케일링 필터를 켜면
 * 화면 전체가 확대돼 UI도 같이 커진다. 둘 중 어느 쪽인지 캡처만 보고는 알 수 없으므로
 * 두 가정을 모두 덮는다 — 고정 크기와, 해상도에 비례한 크기.
 */
export function candidateSizes(videoWidth, videoHeight) {
  const near = GAME_RESOLUTIONS.reduce((best, r) => {
    const d = Math.abs(r[0] - videoWidth) + Math.abs(r[1] - videoHeight)
    return d < best.d ? { r, d } : best
  }, { r: GAME_RESOLUTIONS[0], d: Infinity })
  // 5% 안쪽이면 게임 해상도로 보고 그 값을 쓴다 (창 테두리가 섞여도 흔들리지 않게)
  const height = near.d / videoHeight < 0.05 ? near.r[1] : videoHeight

  const fixed = [0.8, 0.9, 1, 1.1].map((f) => Math.round(BASE_ICON * f))
  const scaled = [0.85, 1, 1.15].map((f) => Math.round(BASE_ICON * (height / BASE_HEIGHT) * f))
  return [...new Set([...fixed, ...scaled])].filter((n) => n >= 12).sort((a, b) => a - b)
}

/** 1단계로 훑을 대표 크기 — 20%쯤 달라도 걸리므로 셋이면 전 구간을 덮는다 */
export function probeSizes(sizes) {
  if (sizes.length <= 3) return sizes
  return [sizes[0], sizes[Math.floor(sizes.length / 2)], sizes[sizes.length - 1]]
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
  const { step = 2, minScore = 0.5, bounds = null } = opts
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
      if (variance < 4) continue // 거의 단색 — 아이콘일 리 없다
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

/**
 * 겹치는 후보를 하나로 합친다.
 * 거리로 자르면 아이콘 크기가 다를 때 어긋나서, 넓이가 얼마나 겹치는지로 본다.
 */
export function suppressOverlaps(boxes, threshold = LOCATE.iouThreshold) {
  const kept = []
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    if (kept.some((k) => iou(box, k) > threshold)) continue
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

  // 1단계 — 자리만 추린다
  const spots = []
  for (const tpl of templates) {
    for (const size of probes) {
      const vec = tpl.coarseVecs[size]
      if (!vec) continue
      const tw = Math.max(6, Math.round(size * ratio))
      const th = tw
      for (const hit of findMatches(cGray, coarse.w, coarse.h, cInt, vec, tw, th, {
        step: 3, minScore: LOCATE.coarseScore,
      }).slice(0, LOCATE.coarseKeep)) {
        if (spots.some((s) => Math.abs(s.x - hit.x) < tw && Math.abs(s.y - hit.y) < th)) continue
        spots.push(hit)
      }
    }
  }

  // 2단계 — 후보 주변만 원본 해상도에서 촘촘히
  const results = []
  for (const spot of spots) {
    const cx = Math.round(spot.x / ratio)
    const cy = Math.round(spot.y / ratio)
    const r = LOCATE.refineRadius
    for (const tpl of templates) {
      for (const size of sizes) {
        const vec = tpl.vecs[size]
        if (!vec) continue
        const best = findMatches(fGray, full.w, full.h, fInt, vec, size, size, {
          step: 1,
          minScore: LOCATE.looseScore,
          bounds: { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r },
        })[0]
        if (best) results.push({ x: best.x, y: best.y, w: size, h: size, score: best.score })
      }
    }
  }

  return suppressOverlaps(results).slice(0, LOCATE.maxCandidates)
}
