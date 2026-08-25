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
  /**
   * 2단계(정련)에서 볼 최대 화면 가로 크기.
   *
   * 정련 비용은 (아이콘 크기)²에 비례한다. 4K에서는 아이콘이 90px이라 창이 1080p의
   * 4배가 되고, 탐색 반경도 크기에 비례해 커져서 한 번에 20초가 걸렸다 —
   * 워커 무응답 안전장치(15초)를 넘겨 '못 찾음'으로 끝난다(실측).
   * 템플릿이 애초에 45px 언저리에서 뜬 것이라 그보다 더 크게 볼 이득도 없다.
   */
  maxFullWidth: 1920,
  /** 1단계 통과선 — 놓치는 것보다 후보가 조금 많은 편이 낫다 */
  coarseScore: 0.4,
  /** 1단계에서 2단계로 넘길 후보 수 */
  coarseKeep: 12,
  /** 2단계에서 후보 주변을 살펴볼 반경(px) */
  refineRadius: 8,
  /** 2단계로 넘길 자리 후보 수 (점수순) */
  spotKeep: 16,
  /** 점수순에서 밀렸지만 어떤 템플릿이 가장 좋아한 자리 — 이만큼 더 얹는다 */
  spotExtra: 8,
  /**
   * 한 모양이 점수순 목록을 독식하지 못하게 하는 상한.
   * 쿨타임 모습을 48장 넣고 나니 그중 한 장이 혼자 자리 8개를 차지해, 황혼 아이콘이
   * 걸린 화면에서 정답 자리(0.604)가 컷(0.66)에 밀려 후보가 통째로 0개가 됐다(실측).
   */
  spotPerTemplate: 3,
  /** 모드 원본(새벽·황혼)은 그 모양이 좋아한 자리를 이만큼 따로 남긴다 */
  spotModeKeep: 4,
  /**
   * 새벽/황혼 판별 기준.
   * 자리를 이긴 모양이 쿨타임 모습이면 그건 모드를 알려주지 못한다 — 대신 그 자리에서
   * 모드 원본끼리만 다시 대조한다. 실측(원본 해상도 44px): 황혼 화면에서 dusk 0.864 /
   * dawn 0.422. 쿨타임 중에는 둘 다 낮게 나오므로 통과선에 걸려 저절로 '모름'이 된다.
   */
  modeScore: 0.60,
  modeMargin: 0.20,
  /** 모드를 가릴 때 자리·크기를 이만큼 주변까지 본다(±px) */
  modeSpan: 2,
  /** 이긴 모양으로 자리를 다듬을 때의 반경(px) */
  polishRadius: 3,
  /** 가장 좋은 결과 하나는 크기를 ±1px 더 다듬는다 (배율 실측값이 여기서 나온다) */
  sizeTrimSpan: 1,
  /**
   * 한 자리에서 자리찾기에 써 볼 대표 모양 수.
   * 성긴 단계 1등이 실제로 맞는 모양과 다를 때가 있다 — 축소하면 쿨타임 숫자가 뭉개져
   * 순위가 뒤집힌다. 그 자리를 엉뚱한 모양으로 찾으면 몇 px 어긋나 점수가 0.96에서
   * 0.46으로 떨어졌다(실측 새벽 20장). 상위 몇 장으로 각각 찾아보고 제일 좋은 걸 쓴다.
   */
  spotReps: 3,
  /**
   * 후보로 남길 최소 점수 (자주색·밝기 평균).
   * 실측 708장(새벽·확장·황혼): 정답 최저 0.568 / 하위 1% 0.727.
   * 아이콘이 없는 화면에서는 최고 0.597이 나오므로, 이 선은 정답을 안 잃는 선에서
   * 최대한 올려 잡동사니 후보를 줄인다.
   */
  looseScore: 0.50,
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

  /*
   * 직접 지정해 저장해둔 모양으로 찾은 경우 — 사용자 화면의 실물이라 1등을 믿어도 된다.
   *
   * 그래도 **부재 최고점(0.597)보다는 위**에 있어야 한다. 예전에 0.55였는데, 템플릿이
   * 74장이 되며 잡음이 0.538 → 0.597로 오르는 바람에 부등호가 뒤집혔다 —
   * 저장 이력이 있는 사용자가 야누스 없는 화면(캐릭터 선택·상점 등)에서 공유를 켜면
   * 엉뚱한 자리가 후보 화면도 없이 조용히 확정된다.
   * 저장본은 제 자리에서 0.9 이상이라 올려도 잃는 게 없다.
   */
  sureScore: 0.66,
  sureMargin: 0.10,
  /** 이 점수 이상이면 격차와 무관하게 그 그룹을 믿는다 — 사실상 원본과 동일한 일치 */
  dominantScore: 0.85,
  /*
   * 내장 원본으로 찾은 경우 — 게임에서 그려지는 모습과 달라 1등이 정답이 아닐 수 있다.
   *
   * 실측 708장(새벽·확장·황혼): 정답 하위 1%가 0.727.
   * 아이콘이 없는 화면 40장에서는 최고 0.597 — 템플릿이 74장이 되면서 0.538에서 올라왔다
   * (모양이 많아질수록 '그중 하나와는 우연히 맞는' 자리가 생긴다).
   * 0.66이면 부재 최고와 0.06 떨어지고, 정답은 708장 중 2장만 놓친다(그 2장은
   * 확정 대신 후보 목록으로 넘어갈 뿐이다).
   */
  builtinSureScore: 0.66,
  builtinSureMargin: 0.15,
  /*
   * 자동 재탐색(사용자가 누른 게 아니라 스스로 도는 경우)의 확정 기준.
   *
   * 화면에 아이콘이 아예 없어도(캐릭터 변경 중 등) 탐색은 무언가를 집어낸다 —
   * 아이콘을 지운 화면으로 실측하니 최고점이 0.506이었다. 그 위로 선을 그으면
   * "없을 때"는 확정도 후보 제시도 하지 않고 조용히 지나간다.
   * 정답 실측은 0.678~1.000이라 여유가 있다.
   */
  autoSureScore: 0.66,
  autoSureMargin: 0.10,
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
  /*
   * 아래로는 예측의 60%까지만 본다.
   *
   * 확장 UI는 창을 키워도 UI가 안 따라와서 예측보다 작게 나온다 — 실측 최저가
   * 예측 대비 78%였다(1080p 예측 45 / 실측 35). 60%면 그보다 넉넉하다.
   * 예전에는 26px 고정이었는데, 그러면 고해상도에서 크기 후보가 폭발하고
   * (4K에서 26~93 = 68가지) 성긴 화면 폭도 vw/2로 커져 4K 한 번에 20초가 넘었다.
   * 비례로 두면 성긴 화면 폭이 해상도와 무관하게 900px 언저리로 수렴한다.
   */
  const lo = Math.max(Math.min(26, base - 2), Math.round(base * 0.6))
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

/**
 * 캡처 아래쪽의 거의 검은 띠를 건너뛴 유효 바닥.
 *
 * 해상도 확장 창을 OBS 캔버스 등으로 공유하면 게임 아래에 레터박스가 깔리고,
 * 그 안에 분리 채팅·아이템 획득 창 같은 **UI 섬**이 떠다닌다(실측: 1080 캡처에서
 * 게임 바닥이 902인데 아래쪽에 43행짜리 채팅창이 뜬다).
 *
 * 예전에는 아래에서부터 처음 만나는 밝은 행을 바닥으로 삼았는데, 그 UI 섬에 걸려
 * 바닥을 1058로 잡았다. 그러면 퀵슬롯 상자가 통째로 아래로 내려가 **아이콘이 검색
 * 범위 밖으로 나간다** — 화면에 멀쩡히 보이는데도 못 찾고 엉뚱한 후보만 남던 원인이다
 * (실측: 확장 영상 312장 중 14장이 이 경우).
 *
 * 그래서 "밝은 행이 이어지는 덩어리" 중 **가장 큰 것**을 게임 화면으로 본다.
 * 게임은 위에서부터 통째로 이어져 902행인데 UI 섬은 1~43행이라 확실히 갈린다.
 */
export function contentBottom(data, w, h) {
  return contentBox(data, w, h).bottom
}

/**
 * 게임 화면이 캡처 안에서 차지하는 **우하단 모서리**.
 *
 * 창을 늘려도 게임이 그만큼 커지지 않고 여백이 생기는 경우가 있다 —
 * 그때 퀵슬롯은 캡처 바닥이 아니라 **게임 화면 바닥**에 붙어 있다.
 * 지정한 영역을 캡처 우하단 기준으로 따라 옮기면 여백 속으로 내려가 버린다(실사용 보고).
 *
 * 가로·세로 각각 "내용이 있는 줄이 이어지는 덩어리" 중 가장 큰 것을 게임 화면으로 본다.
 * 레터박스 안에 떠 있는 작은 UI 섬(분리 채팅 등)에 걸리지 않게 하기 위한 것이다.
 */
export function contentBox(data, w, h) {
  const bright = (p) => data[p] + data[p + 1] + data[p + 2] > 75

  /** 한 축을 훑어 '내용 줄'이 가장 길게 이어지는 구간의 끝을 찾는다 */
  const scan = (n, isContent) => {
    let bestEnd = n
    let bestLen = 0
    let runEnd = -1
    for (let i = n - 1; i >= 0; i--) {
      if (isContent(i)) {
        if (runEnd < 0) runEnd = i
        continue
      }
      if (runEnd >= 0 && runEnd - i > bestLen) {
        bestLen = runEnd - i
        bestEnd = runEnd + 1
      }
      runEnd = -1
    }
    if (runEnd >= 0 && runEnd + 1 > bestLen) {
      bestLen = runEnd + 1
      bestEnd = runEnd + 1
    }
    return bestLen > 0 ? bestEnd : n
  }

  // 행에서 밝은 픽셀이 차지하는 비율로 본다 — 행 평균 밝기로는 어두운 장면에서 게임이 통째로 빠졌다
  const rowHas = (y) => {
    let n = 0
    const row = y * w * 4
    for (let x = 0; x < w; x++) if (bright(row + x * 4)) n++
    return n / w > 0.3
  }
  const colHas = (x) => {
    let n = 0
    for (let y = 0; y < h; y++) if (bright((y * w + x) * 4)) n++
    return n / h > 0.3
  }
  return { right: scan(w, colHas), bottom: scan(h, rowHas) }
}

/**
 * 캡처 크기가 바뀌어도 지정 영역을 **같은 픽셀 자리에 붙잡아 둔다**.
 *
 * region은 0~1 비율 좌표다. 그래서 **아무것도 안 하면 고정이 아니다** —
 * 캡처가 커진 만큼 같은 비율 자리가 아래로 내려가 버린다(실사용 보고:
 * 창이 86px 커지자 상자도 정확히 86px 내려가 검은 여백에 앉았다).
 * 픽셀 좌표로 되돌렸다가 새 크기로 다시 비율을 매기면 화면상 같은 자리에 남는다.
 *
 * 창을 줄여서 영역이 화면 밖으로 나가면 안쪽으로 밀어 넣는다.
 *
 * base / next : { w, h } — 바뀌기 전후의 캡처 크기
 * region      : 0~1 비율 좌표
 */
export function shiftRegion(region, base, next) {
  const w = region.w * base.w
  const h = region.h * base.h
  const x = Math.min(Math.max(region.x * base.w, 0), Math.max(0, next.w - w))
  const y = Math.min(Math.max(region.y * base.h, 0), Math.max(0, next.h - h))
  return { x: x / next.w, y: y / next.h, w: w / next.w, h: h / next.h }
}

/**
 * 퀵슬롯 상자 — 게임 화면의 우하단에 붙어 있다.
 * 기준 해상도에서 바가 차지하는 크기(600×110)를 배율만큼 키운다.
 * bottom은 유효 바닥(contentBottom) — 레터박스가 없으면 h 그대로다.
 * 여기서 아무것도 못 찾을 때만 화면 전체로 넓힌다 (막다른 길이 되지 않게 두는 안전장치).
 */
export function quickslotBox(w, h, bottom = h) {
  const s = Math.max(1, bottom / 768)
  const bw = Math.min(w, Math.round(600 * s))
  const bh = Math.min(bottom, Math.round(110 * s))
  return { x0: w - bw, y0: bottom - bh, x1: w, y1: bottom }
}

/* ── 픽셀 → 특징값 ───────────────────────────────────────── */

/** RGBA 배열 → 밝기 */
export function toLumaPlane(data, out) {
  const n = data.length / 4
  const v = out || new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    v[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return v
}

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

/**
 * findMatches와 같은 훑기지만 **가장 좋은 한 곳만** 돌려준다.
 *
 * 자리를 찾는 단계에서는 통과선을 둘 수 없다 — 대표 모양이 낮은 점수를 내도 다른
 * 모양이 맞을 수 있기 때문이다. 그런데 통과선이 없으면 훑은 자리가 전부 배열에 쌓여
 * (한 번에 수백 개 × 조합 수백 벌) 만들고 정렬하는 값만으로 느려진다 —
 * 실측에서 이 때문에 프레임당 11초가 27초가 됐다. 최고점만 들고 가면 그 비용이 사라진다.
 */
export function findBest(gray, w, h, integral, tpl, tw, th, opts = {}) {
  const { step = 1, bounds = null, minVariance = 4 } = opts
  const { s1, s2, iw } = integral
  const x0 = Math.max(0, bounds?.x0 ?? 0)
  const y0 = Math.max(0, bounds?.y0 ?? 0)
  const x1 = Math.min(w - tw, bounds?.x1 ?? w - tw)
  const y1 = Math.min(h - th, bounds?.y1 ?? h - th)

  const n = tw * th
  const invN = 1 / n
  const invSqrtN = 1 / Math.sqrt(n)
  let bx = -1
  let by = -1
  let bs = -Infinity

  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const mean = boxSum(s1, iw, x, y, tw, th) * invN
      const variance = boxSum(s2, iw, x, y, tw, th) * invN - mean * mean
      if (variance < minVariance) continue
      const inv = invSqrtN / Math.sqrt(variance)
      let dot = 0
      for (let j = 0; j < th; j++) {
        const row = (y + j) * w + x
        const trow = j * tw
        for (let i = 0; i < tw; i++) dot += (gray[row + i] - mean) * tpl[trow + i]
      }
      const score = dot * inv
      if (score > bs) { bs = score; bx = x; by = y }
    }
  }
  return bx < 0 ? null : { x: bx, y: by, score: bs }
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

/**
 * 한 자리에서만 정규화 상호상관을 잰다 (탐색 없이 점수만).
 * 자리를 찾는 일과 "그 자리가 무엇인가"를 채점하는 일을 나누기 위한 것 —
 * 채점은 자리마다 한 번씩이라 템플릿을 아무리 늘려도 비용이 거의 안 는다.
 */
export function nccAt(gray, w, integral, vec, x, y, tw, th, minVariance = 1) {
  const { s1, s2, iw } = integral
  const n = tw * th
  const sum = boxSum(s1, iw, x, y, tw, th)
  const mean = sum / n
  const variance = boxSum(s2, iw, x, y, tw, th) / n - mean * mean
  if (variance < minVariance) return null
  const inv = 1 / (Math.sqrt(n) * Math.sqrt(variance))
  let dot = 0
  for (let j = 0; j < th; j++) {
    const row = (y + j) * w + x
    const trow = j * tw
    for (let i = 0; i < tw; i++) dot += (gray[row + i] - mean) * vec[trow + i]
  }
  return dot * inv
}

/* ── 전체 흐름 ────────────────────────────────────────────── */

/**
 * 줄인 화면에서 자리를 추리고, 원본 해상도에서 다시 확인한다.
 * 줄인 화면에서는 아이콘이 15px 남짓이라 세부가 뭉개져 그것만으로는 판정을 못 믿는다.
 *
 * frames.coarse / frames.full : { data(RGBA), w, h }
 * templates : [{ vecs, coarseVecs, lumaVecs, mode }] — vecs/coarseVecs는 자주색, lumaVecs는 밝기
 *
 * ### 자리 찾기와 채점을 나눈다
 * 예전에는 (자리 × 템플릿 × 크기)마다 원본 해상도 탐색을 돌렸다. 템플릿을 한 장
 * 늘리면 탐색이 통째로 한 벌 늘어나서, 쿨타임 숫자마다 모양을 넣고 싶어도 넣을 수가
 * 없었다(8장 6.6초 → 50장 37초, 실측).
 *
 * 지금은 자리를 **대표 한 장으로 한 번만** 찾고, 그 자리에서 **모든 템플릿을 채점**한다.
 * 채점은 32×32 남짓한 창의 내적 한 번이라 사실상 공짜다 — 템플릿을 수십 장 넣어도
 * 시간이 거의 안 는다. 쿨타임처럼 모습이 계속 변하는 상태는 결국 "그 순간의 모습"이
 * 템플릿에 있어야 점수가 오르므로, 이 구조가 정확도의 전제가 된다.
 */
export function locateIcon({ coarse, full, templates, sizes, probes, ratio }) {
  const cGray = toChroma(coarse.data)
  const cInt = buildIntegral(cGray, coarse.w, coarse.h)
  const cLuma = toLumaPlane(coarse.data)
  const cLumaInt = buildIntegral(cLuma, coarse.w, coarse.h)
  const fGray = toChroma(full.data)
  const fInt = buildIntegral(fGray, full.w, full.h)
  const fLuma = toLumaPlane(full.data)
  const fLumaInt = buildIntegral(fLuma, full.w, full.h)

  /**
   * 1단계 — 주어진 범위에서 자리만 추린다.
   * 어느 크기의 성긴 훑기에 걸렸는지(sMin~sMax)도 함께 기억한다 — 크기 범위가
   * 넓어져서 2단계에서 전 크기를 다 대보면 낭비고, 걸린 크기 근처만 보면 된다.
   */
  const collectSpots = (bounds) => {
    const spots = []
    for (const [ti, tpl] of templates.entries()) {
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
            if (!near.best[ti] || hit.score > near.best[ti]) near.best[ti] = hit.score
            /*
             * 위치는 점수가 가장 높은 히트의 것을 쓴다. 크기가 안 맞는 훑기는
             * 아이콘 안쪽에 몇 px 어긋나게 붙는데, 먼저 왔다는 이유로 그 위치가
             * 스팟을 고정하면 정답 위치가 정련 반경 밖으로 밀린다(실측 9px).
             */
            if (hit.score > near.score) {
              near.score = hit.score
              near.x = hit.x
              near.y = hit.y
              near.tpl = ti
              near.sBest = size
            }
            continue
          }
          spots.push({ ...hit, sMin: size, sMax: size, tpl: ti, sBest: size, best: { [ti]: hit.score } })
        }
      }
    }
    for (const sp of spots) {
      // 자리마다 '성긴 단계에서 잘 붙은 모양' 상위 몇 개를 자리찾기 대표로 남긴다
      sp.reps = Object.entries(sp.best)
        .sort((a, b) => b[1] - a[1])
        .slice(0, LOCATE.spotReps)
        .map(([ti]) => Number(ti))
      /*
       * 줄 세우기는 **자주색과 밝기를 함께** 본다.
       *
       * 성긴 훑기 자체는 자주색으로만 한다(단축키 글자가 밝기를 흐트러뜨려 자리를
       * 찾는 데는 자주색이 강하다). 그런데 그 점수로 자리를 자르면 밝기로는 전혀
       * 다른 것들이 앞자리를 차지한다 — 템플릿이 74장이 되면서, 정답 자리에서
       * 0.907이 나오는데도 후보에 못 오르는 프레임이 생겼다(실측).
       * 재정렬은 자리마다 작은 창 한 번이라 비용이 거의 없다.
       */
      const rep = templates[sp.tpl]
      const lv = rep?.coarseLumaVecs?.[sp.sBest]
      if (!lv) continue
      const tw = Math.max(6, Math.round(sp.sBest * ratio))
      const lm = nccAt(cLuma, coarse.w, cLumaInt, lv, sp.x, sp.y, tw, tw, 1)
      if (lm != null) sp.score = (sp.score + lm) / 2
    }
    return spots
  }

  /*
   * 퀵슬롯 상자(레터박스를 뺀 유효 바닥 기준) → 화면 전체 순으로 넓혀 가며 찾는다.
   * 상자를 캡처 바닥 기준으로 잡으면 레터박스·분리 채팅만 보게 되고(실측: 정답
   * 0.84가 검색조차 안 됨), 상자 없이 전체만 훑으면 필드 이펙트·버프 아이콘이
   * 쿨타임 상태의 정답(0.69~0.78)을 눌렀다 — 둘 다 실측으로 확인한 실패였다.
   * 상자는 원본 해상도 기준으로 잡고 축소 화면 좌표로 옮긴다.
   */
  const boxFull = quickslotBox(full.w, full.h, contentBottom(full.data, full.w, full.h))
  const box = {
    x0: Math.floor(boxFull.x0 * ratio),
    y0: Math.floor(boxFull.y0 * ratio),
    x1: Math.ceil(boxFull.x1 * ratio),
    y1: Math.ceil(boxFull.y1 * ratio),
  }
  let spots = collectSpots(box)
  // 상자에서 아무것도 못 찾았을 때만 화면 전체로 — 막다른 길이 되지 않게 두는 안전장치다
  if (spots.length === 0) spots = collectSpots({})

  /*
   * 자리 후보가 너무 많으면 2단계가 통째로 느려진다 — 점수순으로 자르되,
   * 각 템플릿이 가장 좋아한 자리도 몇 개 얹는다. 쿨타임 모습의 정답 자리는
   * 성긴 점수가 낮아서(0.4~0.5) 점수순만으로 자르면 통째로 잘렸다(실측).
   *
   * **모드를 가진 모양(새벽·황혼 원본)은 자리를 무조건 남긴다.**
   * 쿨타임 모습을 48장 넣고 나서, 황혼 아이콘이 걸린 화면에서 후보가 통째로 0개가
   * 됐다(실측). 황혼 자리의 성긴 점수가 새벽 쿨타임 48장이 만든 자리들에 밀려
   * '점수순 16 + 나머지 8'에 못 들었기 때문이다. 모드 원본은 몇 장뿐이라
   * 무조건 남겨도 비용이 거의 없고, 못 남기면 그 모드를 아예 못 쓰게 된다.
   */
  spots.sort((a, b) => b.score - a.score)
  // 점수순으로 담되, 한 모양이 목록을 독식하지 못하게 한다
  const kept = new Set()
  const perTpl = new Map()
  for (const sp of spots) {
    if (kept.size >= LOCATE.spotKeep) break
    const n = perTpl.get(sp.tpl) ?? 0
    if (n >= LOCATE.spotPerTemplate) continue
    perTpl.set(sp.tpl, n + 1)
    kept.add(sp)
  }
  /** 그 모양이 좋아한 자리를 점수순으로 */
  const likedBy = (ti) => spots
    .filter((sp) => sp.best[ti] != null)
    .sort((a, b) => b.best[ti] - a.best[ti])
  const extra = []
  for (let ti = 0; ti < templates.length; ti++) {
    const liked = likedBy(ti)
    if (!liked.length) continue
    if (templates[ti].mode) {
      // 모드 원본은 상위 몇 자리를 통째로 남긴다 — 이 모양을 놓치면 그 모드를 아예 못 쓴다
      for (const sp of liked.slice(0, LOCATE.spotModeKeep)) kept.add(sp)
      continue
    }
    if (!kept.has(liked[0])) extra.push({ sp: liked[0], v: liked[0].best[ti] })
  }
  /*
   * 같은 자리를 여러 모양이 1등으로 꼽으면 extra에 그 자리가 중복으로 쌓인다.
   * 그대로 앞에서 8개를 자르면 예산이 한 자리의 복제본으로 다 차서 실제로는
   * 한 칸밖에 안 늘어난다 — 거의 같은 쿨타임 모습이 수십 장이라 흔한 일이다.
   */
  extra.sort((a, b) => b.v - a.v)
  const seenSpot = new Set()
  let added = 0
  for (const e of extra) {
    if (added >= LOCATE.spotExtra) break
    if (seenSpot.has(e.sp) || kept.has(e.sp)) continue
    seenSpot.add(e.sp)
    kept.add(e.sp)
    added++
  }
  spots = [...kept]

  /*
   * 2단계 — 후보 주변만 원본 해상도에서 다시 본다.
   *
   * 반경은 성긴 격자(step 3) 오차의 원본 환산값 이상 + 아이콘 크기의 절반 가까이.
   * 쿨타임 숫자가 덮인 상태는 성긴 정점이 숫자끼리 맞는 자리로 끌려가
   * 원본 기준 16px까지 어긋난다(실측) — 좁은 반경으로는 정답이 범위 밖이었다.
   */
  const baseR = Math.max(LOCATE.refineRadius, Math.ceil(1.5 / ratio) + 2)
  const results = []

  /** 한 자리·한 크기에서 모든 템플릿을 채점하고 가장 잘 맞는 모양을 고른다 */
  const scoreAll = (x, y, size) => {
    let bestI = -1
    let bestS = -Infinity
    for (let ti = 0; ti < templates.length; ti++) {
      const t = templates[ti]
      const cv = t.vecs[size]
      if (!cv) continue
      const c = nccAt(fGray, full.w, fInt, cv, x, y, size, size, LOCATE.minVariance)
      if (c == null) continue
      /*
       * 최종 점수는 자주색과 **밝기**를 함께 본다.
       *
       * 자주색만으로는 퀵슬롯의 다른 보라 계열 아이콘이 0.64~0.73까지 올라와
       * 정답(0.78~1.00)과 겹쳤다 — "전혀 상관없는 후보"로 보이던 원인이다.
       * 같은 자리에서 밝기로 재보면 정답 0.52~1.00 / 경쟁 -0.07~0.18로 갈린다.
       */
      const lv = t.lumaVecs?.[size]
      const l = lv ? nccAt(fLuma, full.w, fLumaInt, lv, x, y, size, size, 1) : null
      const s = l == null ? c : (c + l) / 2
      if (s > bestS) { bestS = s; bestI = ti }
    }
    return bestI < 0 ? null : { tpl: bestI, score: bestS }
  }

  /** 한 자리를 한 크기로 확인한다 — 자리는 대표 몇 장으로 찾고 채점은 전 모양으로 */
  const evalAt = (spot, size) => {
    const cx = Math.round(spot.x / ratio)
    const cy = Math.round(spot.y / ratio)
    const r = Math.max(baseR, Math.ceil(spot.sMax * 0.45))
    const bounds = { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }
    let best = null
    for (const ti of spot.reps) {
      const rvec = templates[ti]?.vecs[size]
      if (!rvec) continue
      /*
       * 자리를 찾을 때는 통과선을 두지 않는다(findBest). 대표가 그 자리에서 낮은 점수를
       * 내더라도 **다른 모양이 맞을 수 있기 때문**이다 — 여기서는 "대표가 가장 잘 붙는
       * 자리"만 알면 되고, 합격 판정은 채점이 한다.
       */
      const rough = findBest(fGray, full.w, full.h, fInt, rvec, size, size, {
        step: 2, minVariance: LOCATE.minVariance, bounds,
      })
      if (!rough) continue
      const pick = scoreAll(rough.x, rough.y, size)
      if (!pick) continue
      // 이긴 모양으로 자리를 한 번 더 다듬는다 — 대표와 몇 px 어긋날 수 있다
      const polish = findBest(fGray, full.w, full.h, fInt, templates[pick.tpl].vecs[size], size, size, {
        step: 1, minVariance: LOCATE.minVariance,
        bounds: {
          x0: rough.x - LOCATE.polishRadius, y0: rough.y - LOCATE.polishRadius,
          x1: rough.x + LOCATE.polishRadius, y1: rough.y + LOCATE.polishRadius,
        },
      })
      const at = polish ?? rough
      const final = scoreAll(at.x, at.y, size) ?? pick
      if (!best || final.score > best.score) {
        best = {
          x: at.x, y: at.y, w: size, h: size, score: final.score,
          tpl: final.tpl, mode: templates[final.tpl]?.mode ?? null,
        }
      }
    }
    return best && best.score >= LOCATE.looseScore ? best : null
  }

  /**
   * 이 자리가 새벽인지 황혼인지 — **모드 원본끼리만** 비교한다.
   *
   * 자리를 이긴 모양이 쿨타임 모습이면 모드를 알 수 없다(mode: null). 그건 "어느
   * 쪽인지 모른다"가 아니라 "그 모양이 모드를 안 담고 있다"일 뿐이라, 같은 자리에서
   * 원본 둘을 대보면 대개 확실히 갈린다(실측 44px: 황혼 화면 dusk 0.864 / dawn 0.422,
   * 새벽 화면 dawn 0.796 / dusk 0.357).
   *
   * 이긴 모양의 자리·크기를 그대로 쓰면 원본의 정점과 몇 px 어긋나 점수가 깎인다 —
   * 원본은 몇 장뿐이라 주변을 조금 훑어도 비용이 거의 없다. 최종 후보에만 적용한다.
   */
  const modeAt = (x, y, size) => {
    const peak = (t) => {
      let best = -Infinity
      for (let ds = -LOCATE.modeSpan; ds <= LOCATE.modeSpan; ds++) {
        const n = size + ds
        const cv = t.vecs[n]
        if (!cv) continue
        const lv = t.lumaVecs?.[n]
        for (let dy = -LOCATE.modeSpan; dy <= LOCATE.modeSpan; dy++) {
          for (let dx = -LOCATE.modeSpan; dx <= LOCATE.modeSpan; dx++) {
            const px = x + dx
            const py = y + dy
            if (px < 0 || py < 0 || px + n > full.w || py + n > full.h) continue
            const c = nccAt(fGray, full.w, fInt, cv, px, py, n, n, LOCATE.minVariance)
            if (c == null) continue
            const l = lv ? nccAt(fLuma, full.w, fLumaInt, lv, px, py, n, n, 1) : null
            const sc = l == null ? c : (c + l) / 2
            if (sc > best) best = sc
          }
        }
      }
      return best
    }
    let top = null
    let second = -Infinity
    for (const t of templates) {
      if (!t.mode) continue
      const sc = peak(t)
      if (sc === -Infinity) continue
      if (!top || sc > top.score) {
        if (top) second = top.score
        top = { mode: t.mode, score: sc }
      } else if (sc > second) second = sc
    }
    if (!top || top.score < LOCATE.modeScore) return null
    if (second > -Infinity && top.score - second < LOCATE.modeMargin) return null
    return top.mode
  }

  /*
   * 성긴 단계는 크기가 꽤 달라도 걸린다 — 걸린 크기에서 너무 먼 것만 거른다.
   * (실측: 쿨타임 모습은 30px 훑기에만 걸렸는데 실제 아이콘은 46px — 1.25배로는 놓쳤다)
   */
  const allowed = (spot) => sizes.filter((n) => n >= spot.sMin / 1.6 && n <= spot.sMax * 1.6)
  /** 크기를 1px씩 다 볼 필요는 없다 — 1px 차이의 점수 차가 0.01 수준이라(실측) 한 칸 걸러 본다 */
  const everyOther = (arr) => arr.filter((_, i) => i % 2 === 0 || i === arr.length - 1)

  /*
   * 2단계 — 후보 주변만 원본 해상도에서 다시 본다.
   *
   * 크기는 자리마다 따로 본다. 전 화면이 같은 배율이니 한 번 알아내면 될 것 같지만,
   * 실제로 그렇게 묶었더니 쿨타임 프레임 92장이 통째로 날아갔다(실측) — 정답 자리는
   * 성긴 점수가 낮아 크기를 정하는 표본에 못 끼고, 엉뚱한 자리가 정한 크기로만
   * 채점되면서 자기 크기를 못 만나기 때문이다.
   *
   * 대신 크기를 한 칸 걸러 본다. 1px 차이의 점수 차가 0.005~0.01 수준이라(실측:
   * 43/44/45px에서 0.842/0.838/0.874) 사이를 건너뛰어도 정점은 잡힌다.
   */
  for (const spot of spots) {
    for (const size of everyOther(allowed(spot))) {
      const hit = evalAt(spot, size)
      if (hit) results.push(hit)
    }
  }
  /*
   * 1등만 크기를 ±1px 다듬는다. 이 크기가 곧 UI 배율의 실측값이 되어(uiCalibration)
   * 룬·부스터 템플릿 크기의 근거가 되므로 한 칸 걸러 얻은 값을 그대로 두면 안 된다.
   */
  if (results.length) {
    const top = results.reduce((a, b) => (b.score > a.score ? b : a))
    const spot = spots.find((sp) => Math.abs(sp.x / ratio - top.x) < top.w && Math.abs(sp.y / ratio - top.y) < top.h)
    if (spot) {
      for (let d = -LOCATE.sizeTrimSpan; d <= LOCATE.sizeTrimSpan; d++) {
        if (d === 0 || !sizes.includes(top.w + d)) continue
        const hit = evalAt(spot, top.w + d)
        if (hit) results.push(hit)
      }
    }
  }

  const out = suppressOverlaps(results).slice(0, LOCATE.maxCandidates)
  for (const r of out) r.mode = modeAt(r.x, r.y, r.w) ?? r.mode
  return out
}
