/**
 * 경험치 여정 차트의 순수 계산 — PC·모바일 공용.
 *
 * 화면 크기(viewBox)만 다르고 좌표를 만드는 방식은 같아서, 여기서 한 번만 정의한다.
 * y축은 누적 레벨(level + exp%/100), x축은 히스토리 날짜 + 오늘, 그 오른쪽이 목표 지점.
 */

export const WK_DAY = ['일', '월', '화', '수', '목', '금', '토']

export const dateFrom = (baseMs, days) => {
  const d = new Date(baseMs)
  d.setDate(d.getDate() + days)
  return d
}

export const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${WK_DAY[d.getDay()]})`

export const mdLabel = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`

/** 실측 페이스 — 히스토리 첫 스냅샷 대비 하루 평균, 그리고 최근 7일 상승분 (단위: 레벨) */
export function journeyStats(history, nowCum, nowMs) {
  if (!history.length) return { avg: null, week: null }
  const first = history[0]
  const firstCum = first.level + first.exp_rate / 100
  const spanDays = Math.max(1, Math.round((nowMs - new Date(first.date).getTime()) / 86400000))
  const avg = (nowCum - firstCum) / spanDays
  // 최근 7일: 7일 전 스냅샷과 비교
  const wk = history.find((h) => (nowMs - new Date(h.date).getTime()) / 86400000 <= 7.5) || first
  const week = nowCum - (wk.level + wk.exp_rate / 100)
  return { avg: avg > 0 ? avg : null, week: week > 0 ? week : null }
}

/**
 * 차트 좌표 일체.
 * @param V {W,H,padL,padR,padT,padB} — padL은 y축 라벨 전용 여백, padR=0이면 플롯 우측 끝이 SVG 경계와 일치
 * @param histSpan 과거 구간이 차지하는 플롯 폭 비율 (나머지는 목표까지의 예측 구간)
 */
export function chartGeometry({ history, level, expRate, targetLevel, nowMs, V, histSpan = 0.62 }) {
  const nowCum = level + expRate / 100
  const pts = history.map((h) => ({ ...h, cum: h.level + h.exp_rate / 100 }))
  // 오늘 점도 실제 날짜를 갖는다 — 툴팁에서 과거 점과 같은 형식으로 쓰기 위해 (KST 기준)
  const todayStr = new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const seq = [...pts, { date: todayStr, isNow: true, cum: nowCum, level, exp_rate: expRate }]

  const allCum = seq.map((p) => p.cum).concat([targetLevel])
  const lo = Math.floor(Math.min(...allCum) * 10) / 10 - 0.05
  const hi = Math.ceil(Math.max(...allCum)) + 0.2

  const plotW = V.W - V.padL - V.padR
  const X = (i) => V.padL + plotW * histSpan * i / Math.max(1, seq.length - 1)
  const Y = (v) => V.padT + (V.H - V.padT - V.padB) * (hi - v) / (hi - lo)

  const coords = seq.map((p, i) => ({ ...p, x: X(i), y: Y(p.cum) }))
  const now = coords[coords.length - 1]
  const tgx = V.padL + plotW
  const tgy = Y(targetLevel)
  const base = V.H - V.padB

  const line = 'M ' + coords.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')
  const area = `M ${coords[0].x.toFixed(1)} ${base} `
    + coords.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    + ` L ${now.x.toFixed(1)} ${base} Z`
  const proj = `M ${now.x.toFixed(1)} ${now.y.toFixed(1)} L ${tgx.toFixed(1)} ${tgy.toFixed(1)}`
  const projFill = `${proj} L ${tgx.toFixed(1)} ${base} L ${now.x.toFixed(1)} ${base} Z`

  const gridLevels = []
  for (let lv = Math.ceil(lo); lv <= Math.floor(hi); lv++) gridLevels.push(lv)

  return { coords, now, tgx, tgy, lo, hi, gridLevels, line, area, proj, projFill, Y }
}
