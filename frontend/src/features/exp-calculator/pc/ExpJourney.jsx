import { useMemo, useState } from 'react'
import { fmtPct } from '../logic'

/**
 * 경험치 여정 패널 — 프로필 · 통계 · 등반 차트 · 목표/결과를 하나로.
 *
 * 차트는 SVG. y축은 누적 레벨(level + exp%/100), x축은 히스토리 날짜 + 현재(NOW).
 * 과거는 실선(파랑 면적), 현재→목표는 예측선(주황 점선). 캐릭터가 현재 지점에 서 있고
 * 각 점에 hover하면 툴팁. 목표 지점엔 도달 날짜 깃발.
 */

const SKY = 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))'
const C_DAY = 'var(--accent-bright)'
const C_WEEK = '#9247c9'
const C_ONCE = '#e8a20c'
const WK_DAY = ['일', '월', '화', '수', '목', '금', '토']

const dateFrom = (baseMs, days) => { const d = new Date(baseMs); d.setDate(d.getDate() + days); return d }
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${WK_DAY[d.getDay()]})`
const mdLabel = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`

function GoalLevelInput({ value, onCommit, min, max }) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"
      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}>
      <input
        type="text" inputMode="numeric"
        value={editing ? text : String(value)}
        onFocus={() => { setText(String(value)); setEditing(true) }}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => {
          setEditing(false)
          const n = parseInt(text, 10)
          onCommit(Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
        className="bg-transparent outline-none text-right font-bold tabular-nums text-sm pr-[3px]"
        style={{ width: '4.5ch', color: 'var(--text-strong)' }}
      />
      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>Lv</span>
    </div>
  )
}

function Stat({ label, value, color, sub }) {
  return (
    <div className="flex-1 px-4 py-3.5 min-w-0">
      <div className="text-[12.5px] font-bold mb-1 truncate" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[22px] font-bold tabular-nums leading-none truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] mt-1 truncate" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

export default function ExpJourney({
  char, history, dateCreate, goal, result, breakdown,
  onGoalLevel,
}) {
  const level = char.character_level
  const nowCum = level + char.exp_rate / 100

  // 렌더 중 시각 호출은 금지 → 최초 마운트 시 한 번만 고정
  const nowMs = useMemo(() => new Date().getTime(), [])

  // 통계
  const created = useMemo(() => (dateCreate ? new Date(dateCreate) : null), [dateCreate])
  const ageDays = created ? Math.max(1, Math.round((nowMs - created.getTime()) / 86400000)) : null
  const stats = useMemo(() => {
    if (!history.length) return { avg: null, week: null }
    const first = history[0]
    const firstCum = first.level + first.exp_rate / 100
    const spanDays = Math.max(1, Math.round((nowMs - new Date(first.date).getTime()) / 86400000))
    const avg = (nowCum - firstCum) / spanDays
    // 최근 7일: 7일 전 스냅샷과 비교
    const wk = history.find((h) => (nowMs - new Date(h.date).getTime()) / 86400000 <= 7.5) || first
    const week = nowCum - (wk.level + wk.exp_rate / 100)
    return { avg: avg > 0 ? avg : null, week: week > 0 ? week : null }
  }, [history, nowCum, nowMs])

  // ── 차트 좌표 ──
  // padL = y축 라벨 전용 여백(라벨 왼쪽 끝이 SVG 좌측 경계에 닿음), padR = 0 → 플롯 우측 끝이 SVG 경계와 일치.
  // SVG 박스 자체를 위 통계 스트립과 같은 폭으로 두므로 좌우 정렬이 맞는다.
  const V = { W: 1000, H: 300, padL: 48, padR: 0, padT: 56, padB: 52 }
  const pts = useMemo(() => history.map((h) => ({ ...h, cum: h.level + h.exp_rate / 100 })), [history])
  const nowPoint = { date: 'now', cum: nowCum, level, exp_rate: char.exp_rate }
  const seq = [...pts, nowPoint]

  const targetCum = result.target
  const allCum = seq.map((p) => p.cum).concat([targetCum])
  const lo = Math.floor(Math.min(...allCum) * 10) / 10 - 0.05
  const hi = Math.ceil(Math.max(...allCum)) + 0.2
  // 과거 구간은 플롯 폭의 62%, 목표 지점은 우측 끝(100%)에 둬서 좌우 여백을 대칭으로
  const histSpan = 0.62
  const plotW = V.W - V.padL - V.padR
  const X = (i) => V.padL + plotW * histSpan * i / Math.max(1, seq.length - 1)
  const Y = (v) => V.padT + (V.H - V.padT - V.padB) * (hi - v) / (hi - lo)
  const coords = seq.map((p, i) => ({ ...p, x: X(i), y: Y(p.cum) }))
  const now = coords[coords.length - 1]
  const tgx = V.padL + plotW
  const tgy = Y(targetCum)

  const line = 'M ' + coords.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')
  const area = `M ${coords[0].x.toFixed(1)} ${V.H - V.padB} ` + coords.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L ${now.x.toFixed(1)} ${V.H - V.padB} Z`
  const reachable = result.days != null
  const proj = `M ${now.x.toFixed(1)} ${now.y.toFixed(1)} L ${tgx.toFixed(1)} ${tgy.toFixed(1)}`
  const projFill = `${proj} L ${tgx.toFixed(1)} ${V.H - V.padB} L ${now.x.toFixed(1)} ${V.H - V.padB} Z`

  // y 그리드 (정수 레벨)
  const gridLevels = []
  for (let lv = Math.ceil(lo); lv <= Math.floor(hi); lv++) gridLevels.push(lv)

  const [hover, setHover] = useState(null) // index into coords

  const goalDateObj = reachable ? dateFrom(nowMs, result.days) : null
  const flagText = goalDateObj ? `${goalDateObj.getMonth() + 1}.${goalDateObj.getDate()}` : '—'
  const flagDow = goalDateObj ? WK_DAY[goalDateObj.getDay()] : ''

  const pct = (p) => `${p.toFixed(1)}%`
  const HXW = 100 / V.W // %/유닛
  const HYH = 100 / V.H

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>

      {/* 헤더 (캐릭터 이미지는 그래프 위에 있으므로 여기선 생략) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 pt-5 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {char.world_icon && <img src={char.world_icon} alt="" className="w-[22px] h-[22px] object-contain" style={{ imageRendering: 'pixelated' }} />}
            <span className="text-[22px] font-bold truncate">{char.character_name}</span>
            <span className="text-[13px] font-bold tabular-nums text-white px-2.5 py-0.5 rounded-md shrink-0" style={{ background: SKY }}>Lv.{level}</span>
          </div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {char.job_name}
            {created && <> · <span className="tabular-nums">{fmtDate(created).slice(0, 10).replace(/-/g, '.')}</span> 생성 <span style={{ color: 'var(--text-dim)' }}>({ageDays.toLocaleString()}일째)</span></>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>목표 레벨</span>
          <GoalLevelInput value={goal.level || level + 1} onCommit={onGoalLevel} min={level + 1} max={300} />
        </div>
      </div>

      {/* 통계 스트립 */}
      <div className="mx-6 mb-1.5 flex rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--panel-border)', background: 'linear-gradient(180deg, var(--mpl-row), var(--panel-bg))' }}>
        <Stat label="현재 경험치" value={`${char.exp_rate.toFixed(3)}%`} color={C_DAY} sub={`Lv.${level} 진행 중`} />
        <div className="w-px my-3" style={{ background: 'var(--panel-border)' }} />
        <Stat label="최근 7일 획득" value={stats.week != null ? `+${stats.week.toFixed(1)}Lv` : '—'} color={C_DAY}
          sub={`목표 Lv.${result.target}`} />
        <div className="w-px my-3" style={{ background: 'var(--panel-border)' }} />
        <Stat label="하루 평균 획득" value={stats.avg != null ? `+${(stats.avg * 100).toFixed(1)}%p` : '—'} color={C_DAY} sub="실측 페이스" />
        <div className="w-px my-3" style={{ background: 'var(--panel-border)' }} />
        <Stat label="목표 도달 예상" value={goalDateObj ? `${flagText} (${flagDow})` : '—'} color={C_ONCE}
          sub={result.days != null ? `약 ${result.days.toLocaleString()}일 후` : '현재 페이스론 불가'} />
      </div>

      {/* 차트 — 바깥 px-6로 위 통계 스트립과 좌우 경계를 맞추고,
           안쪽 relative 박스는 SVG와 정확히 같은 크기라 오버레이(%) 좌표가 어긋나지 않는다 */}
      <div className="px-6 pt-1">
      <div className="relative"
        onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${V.W} ${V.H}`} className="w-full block overflow-visible">
          <defs>
            <linearGradient id="expfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--mpl-sky-from)" stopOpacity="0.3" />
              <stop offset="1" stopColor="var(--mpl-sky-from)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="projfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0a828" stopOpacity="0.15" />
              <stop offset="1" stopColor="#f0a828" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {gridLevels.map((lv) => (
            <g key={lv}>
              <line x1={V.padL} y1={Y(lv)} x2={V.W - V.padR} y2={Y(lv)} stroke="var(--row-divider)" strokeWidth="1" strokeDasharray="3 4" />
              {/* 라벨은 좌측 여백 안에 우측정렬 + 그리드선과 수직 중앙 정렬 */}
              <text x={V.padL - 8} y={Y(lv)} dominantBaseline="middle" textAnchor="end" fontSize="12.5" fill="var(--text-dim)">
                Lv.{lv}
              </text>
            </g>
          ))}
          {reachable && <path d={projFill} fill="url(#projfill)" />}
          <path d={area} fill="url(#expfill)" />
          <path d={line} fill="none" stroke="var(--mpl-sky-to)" strokeWidth="2.5" strokeLinejoin="round" />
          {reachable && <path d={proj} fill="none" stroke="#f0a828" strokeWidth="2.5" strokeDasharray="6 5" />}
          {/* x축 날짜: 과거 전부 + 오늘 + 목표 도달일 */}
          {coords.slice(0, -1).map((p) => (
            <text key={p.date} x={p.x} y={V.H - V.padB + 20} fontSize="12.5" fill="var(--text-dim)" textAnchor="middle">
              {mdLabel(p.date)}
            </text>
          ))}
          <text x={now.x} y={V.H - V.padB + 20} fontSize="12.5" fill="var(--accent-bright)" textAnchor="middle" fontWeight="700">오늘</text>
          {goalDateObj && (
            <text x={tgx} y={V.H - V.padB + 20} fontSize="12.5" fill="#c8890f" textAnchor="end" fontWeight="700">
              {goalDateObj.getMonth() + 1}/{goalDateObj.getDate()}
            </text>
          )}
          {/* 과거 점 (hover 대상) */}
          {coords.slice(0, -1).map((p, i) => (
            <g key={p.date}>
              <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="var(--panel-bg)" stroke="var(--mpl-sky-to)" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="16" fill="transparent"
                onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }} />
            </g>
          ))}
          {reachable && <circle cx={tgx} cy={tgy} r="7" fill="#f0a828" stroke="var(--panel-bg)" strokeWidth="3" />}
          {/* 예상 라벨 */}
          {reachable && result.days > 0 && (
            <text x={(now.x + tgx) / 2} y={(now.y + tgy) / 2 - 10} fontSize="12" fill="#c8890f" textAnchor="middle" fontWeight="700"
              transform={`rotate(-6 ${(now.x + tgx) / 2} ${(now.y + tgy) / 2 - 10})`}>
              예상 +{result.days}일
            </text>
          )}
        </svg>

        {/* 현재 캐릭터 마커 (그래프 위에 서 있음) */}
        <div className="absolute pointer-events-none" style={{
          left: `calc(${(now.x * HXW).toFixed(2)}% - 52px)`,
          top: `calc(${(now.y * HYH).toFixed(2)}% - 116px)`,
          width: 104, height: 104, overflow: 'hidden', filter: 'drop-shadow(0 3px 4px rgba(31,44,61,.25))',
        }}>
          {char.character_image && (
            <img src={char.character_image} alt="" className="w-full h-full object-contain scale-[2.5] -translate-y-[3%]" style={{ imageRendering: 'pixelated' }} />
          )}
        </div>
        <div className="absolute pointer-events-none" style={{
          left: `calc(${(now.x * HXW).toFixed(2)}% - 7px)`,
          top: `calc(${(now.y * HYH).toFixed(2)}% - 15px)`,
          width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid var(--accent-bright)',
        }} />
        <div className="absolute rounded-full pointer-events-none" style={{
          left: `calc(${(now.x * HXW).toFixed(2)}% - 6px)`,
          top: `calc(${(now.y * HYH).toFixed(2)}% - 6px)`,
          width: 12, height: 12, background: 'var(--accent-bright)', border: '2.5px solid var(--panel-bg)', boxShadow: '0 2px 5px rgba(47,159,216,.5)',
        }} />

        {/* hover 툴팁 */}
        {hover != null && coords[hover] && (() => {
          const p = coords[hover]
          const prev = coords[hover - 1]
          const delta = prev ? (p.cum - prev.cum) * 100 : null
          return (
            <div className="absolute pointer-events-none z-10 rounded-[10px] px-3 py-2 text-center whitespace-nowrap"
              style={{
                left: `calc(${(p.x * HXW).toFixed(2)}% )`, top: `calc(${(p.y * HYH).toFixed(2)}% - 12px)`,
                transform: 'translate(-50%, -100%)',
                background: '#22303f', color: '#fff', boxShadow: '0 6px 16px rgba(31,44,61,.3)',
              }}>
              <div className="text-[12px] font-bold opacity-75">{p.date.replace(/-/g, '.')} ({WK_DAY[new Date(p.date).getDay()]})</div>
              <div className="text-[15px] font-bold tabular-nums leading-snug">
                Lv.{p.level} · {pct(p.exp_rate)}
              </div>
              {delta != null && <div className="text-[12px]" style={{ color: '#8fd8f5' }}>전일 대비 +{delta.toFixed(1)}%p</div>}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-[6px]" style={{
                width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #22303f',
              }} />
            </div>
          )
        })()}

      </div>
      </div>

      {/* 하단 결과 */}
      <div className="flex items-center border-t" style={{ borderColor: 'var(--row-divider)', background: 'var(--mpl-row)' }}>
        <div className="flex-[1.3] text-center py-3.5">
          <div className="text-[12px] font-bold" style={{ color: 'var(--text-muted)' }}>
            Lv.{result.target} 도달까지
          </div>
          <div className="text-[25px] font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>
            {result.days == null ? '불가' : result.days === 0 ? '달성!' : `약 ${result.days.toLocaleString()}일`}
          </div>
        </div>
        <div className="w-px self-stretch my-3" style={{ background: 'var(--panel-border)' }} />
        {[
          { label: '일일', value: breakdown.dailyTotal, color: C_DAY },
          { label: '주간', value: breakdown.weeklyTotal, color: C_WEEK },
          { label: '일회성', value: breakdown.onceTotal, color: C_ONCE },
        ].map((m) => (
          <div key={m.label} className="flex-1 text-center py-3.5">
            <div className="text-[12px] font-bold" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
            <div className="text-[19px] font-bold tabular-nums" style={{ color: m.color }}>{fmtPct(m.value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
