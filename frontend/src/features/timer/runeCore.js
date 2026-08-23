/**
 * 룬 등장 감지 — 계산부. DOM을 쓰지 않아 워커에서도 그대로 돌아간다.
 *
 * 화면 상단에 뜨는 "룬이 등장 했습니다!" 문구에서 '등장' 부분을 템플릿으로 찾는다.
 * 왜 하필 '등장'인가 — 해방 후 문구(축복의 룬: 고대의 힘이…)·솔 에르다·마일리지 안내가
 * 전부 같은 초록 계열이라 색·위치로는 못 가르는데, 등장 문구에만 이 단어가 있다.
 *
 * 색 임계 방식은 폐기했다. 글자 색 자체가 G−R 중앙값 74~76이라 어떤 임계를 잡아도
 * 어두운 맵에선 넉넉하고 밝은 맵에선 글자의 5%만 남아 놓쳤다(실측).
 * 초록 우세 평면의 NCC는 밝기와 무관하게 "모양"만 보므로 두 맵 모두에서 붙는다.
 *
 * 검증: 영상 2편(다른 캐릭터·어두운 풀밭 맵·밝은 하늘 맵) 2,327프레임 전수 —
 * 룬 4회 전부 감지, 오탐 0. 양성 0.522~1.000 / 음성 최고 0.41.
 */
import { buildIntegral, findMatches, uiScale } from './locateCore'

export const RUNE = {
  /** 판정 통과선 — 실측 양성 최저 0.522, 음성 최고 0.41 사이 */
  threshold: 0.47,
  /**
   * 성긴 훑기에서 정련으로 넘길 통과선.
   *
   * 글자 템플릿의 자기상관은 매우 날카롭다 — 정점 1px 옆에서 0.577→0.23으로
   * 떨어지는 프레임이 실측됐다. step 3 + 0.25로 잡았더니 그 프레임들을 통째로
   * 놓쳐서(0.577이 0.386으로), 격자를 촘촘히(step 2) 하고 통과선을 확 낮췄다.
   * 이 조합은 전 프레임(2,327장) 시뮬레이션에서 step 1 전수 스캔과 결과가 같았다.
   */
  coarseScore: 0.12,
  coarseStep: 2,
  coarseKeep: 64,
  /** 성긴 후보 주변을 1px 단위로 다시 볼 반경 — 격자 간격(2px)을 덮고도 남게 */
  refineRadius: 2,
  /**
   * 문구가 뜨는 띠 — 화면 비율 기준. 1080p 실측으로 문구는 y 187~225에 있고,
   * 창모드 제목 표시줄(+30px 남짓)과 해상도별 오차를 감안해 넉넉히 잡았다.
   * 가로는 문구가 중앙 부근에 정렬되므로 실측(x 628~793) 좌우로 여유를 둔다.
   */
  band: { x0: 0.15, x1: 0.70, y0: 0.09, y1: 0.26 },
  /** 문구는 4~5초 떠 있다 — 이 주기로 훑어도 두 번은 걸린다 */
  scanIntervalMs: 2000,
  /** 감지 후 같은 문구로 다시 울리지 않는 시간. 룬 주기는 최소 10분이라 넉넉하다 */
  suppressMs: 90000,
}

/**
 * RGBA → 초록 우세 성분 G − (R+B)/2.
 * 아이콘 탐색의 자주색 성분(toChroma)과 부호만 반대인 관계다 — 문구가 초록이라 이쪽을 쓴다.
 */
export function toGreen(data) {
  const n = data.length / 4
  const v = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    v[i] = data[p + 1] - (data[p] + data[p + 2]) / 2
  }
  return v
}

/** 템플릿은 1080p 화면에서 떴다 — 현재 화면의 UI 배율로 환산한다 */
export function runeTemplateScale(videoHeight) {
  return uiScale(videoHeight) / uiScale(1080)
}

/**
 * 훑어볼 배율 후보.
 *
 * 예측(세로 크기 비례)은 확장 UI에서 크게 어긋난다 — 야누스 아이콘에서 실측한
 * 배율이 있으면 그쪽을 쓴다(아이콘 기본 32px 고정이라 가장 정확).
 * 글자 NCC는 배율 몇 %에도 민감해서(제목표시줄 2.8% 어긋남에 0.98→0.84 실측)
 * 기준 주변 ±4%를 2% 간격으로 함께 본다. 성공하면 그 배율로 고정된다.
 *
 * @param predicted 세로 크기로 예측한 템플릿 배율
 * @param measured  야누스 아이콘 실측 UI 배율 (없으면 null)
 */
export function runeScaleCandidates(predicted, measured) {
  /*
   * 실측이 없으면 예측(비례)에 더해 **기본 UI 배율(1.0)** 기준도 함께 본다 —
   * 확장 UI는 창이 커져도 UI가 기본 크기 언저리라, 야누스를 안 쓰는 사용자도
   * 이 후보로 잡힌다. 성공하면 고정되므로 초기 몇 스캔만 비용이 든다.
   */
  const bases = measured != null
    ? [measured / uiScale(1080)]
    : [predicted, 1 / uiScale(1080)]
  const out = new Set()
  for (const base of bases) {
    for (const k of [0.96, 0.98, 1, 1.02, 1.04]) {
      const s = Math.round(base * k * 1000) / 1000
      if (s >= 0.3) out.add(s)
    }
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * band(RGBA 조각) 안에서 템플릿들과 가장 닮은 자리를 찾는다.
 * templates: [{ vec, tw, th, kind }] — vec은 정규화된 초록 성분
 * 반환: { score, kind, x, y } | null
 *
 * findMatches의 분산 하한(variance < 4 제외)이 곧 평탄 창 안전장치다 —
 * 하늘처럼 밋밋한 창은 분산이 0에 가까워 NCC가 수치적으로 폭주할 수 있는데(실측),
 * 아예 후보에서 빠지므로 여기까지 오지 않는다.
 */
export function scanRuneBand({ data, w, h }, templates) {
  const gray = toGreen(data)
  const integral = buildIntegral(gray, w, h)
  let best = null
  for (const t of templates) {
    if (!t.vec || t.tw > w || t.th > h) continue
    const vec = t.vec instanceof Float32Array ? t.vec : new Float32Array(t.vec)
    const coarse = findMatches(gray, w, h, integral, vec, t.tw, t.th, {
      step: RUNE.coarseStep, minScore: RUNE.coarseScore,
    }).slice(0, RUNE.coarseKeep)
    for (const c of coarse) {
      const r = RUNE.refineRadius
      const hit = findMatches(gray, w, h, integral, vec, t.tw, t.th, {
        step: 1,
        minScore: RUNE.coarseScore,
        bounds: { x0: c.x - r, y0: c.y - r, x1: c.x + r, y1: c.y + r },
      })[0]
      if (hit && (!best || hit.score > best.score)) {
        best = { score: hit.score, kind: t.kind, scale: t.scale ?? null, x: hit.x, y: hit.y }
      }
    }
  }
  return best
}
