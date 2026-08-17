import { useMemo, useState } from 'react'
import Select from '../../../components/common/Select'
import Tooltip from '../../../components/common/Tooltip'
import { fmtPct } from '../logic'
import { WK_DAY, fmtDate, mdLabel, journeyStats, chartGeometry } from '../journey'

/**
 * 경험치 여정 패널 — 프로필 · 통계 · 등반 차트 · 기여도 요약.
 *
 * 차트는 SVG. y축은 누적 레벨(level + exp%/100), x축은 히스토리 날짜 + 현재(NOW).
 * 예전에는 오른쪽에 목표까지의 예측선이 이어졌는데, 예측을 없애면서 실측 구간만 남았다.
 *
 * 레벨 드롭다운이 예전 '목표 레벨' 자리다 — 여기서 고른 레벨 기준으로
 * (이 캐릭터의 보약·아티팩트 보너스를 포함해) 아래 카드들이 계산된다.
 */

const SKY = 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))'
const C_DAY = 'var(--accent-bright)'
const C_WEEK = '#9247c9'
const C_ONCE = '#e8a20c'
/* 하루 평균은 초록 — 위 두 값(하늘·보라)과 겹치지 않으면서 아래 요약의 색과도 안 부딪힌다 */
const C_PACE = '#3f9e57'

function Stat({ label, value, color }) {
  return (
    <div className="flex-1 px-4 py-3.5 min-w-0">
      <div className="text-[12.5px] font-bold mb-1 truncate" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[22px] font-bold tabular-nums leading-none truncate" style={{ color }}>{value}</div>
    </div>
  )
}

/**
 * 합계가 어느 스킬에서 얼마씩 왔는지 — 같은 항목이 여러 스킬에 걸쳐 있어
 * 숫자만 보면 근거를 알 수 없다 (심볼 계산기의 일퀘 툴팁과 같은 방식).
 */
function sourceText(bonus, key) {
  return (bonus.sources || [])
    .filter((src) => src[key] > 0)
    .map((src) => `${src.skill_name} +${src[key]}%`)
    .join(' + ')
}

function BonusChips({ bonus }) {
  if (!bonus) {
    return (
      <span className="text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
        이 캐릭터에서 경험치 보너스를 찾지 못했습니다
      </span>
    )
  }
  /*
   * 칩 색은 아래 요약(일일·주간)과 같은 규칙을 따른다 — 어느 쪽에 붙는 보너스인지
   * 색만 보고도 이어진다. 전부 하늘색이면 배지·차트와 뭉쳐 보인다.
   */
  const chips = [
    ['몬파', 'monsterPark', bonus.monsterPark, C_WEEK],
    ['에픽던전', 'epicDungeon', bonus.epicDungeon, C_WEEK],
    ['아케인 일퀘', 'arcaneDaily', bonus.arcaneDaily, C_DAY],
    ['그란디스 일퀘', 'grandisDaily', bonus.grandisDaily, C_DAY],
  ].filter(([, , v]) => v > 0)
  if (!chips.length) return null
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {chips.map(([name, key, v, color]) => (
        <Tooltip key={name} text={sourceText(bonus, key)}>
          <span
            className="text-[12px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
          >
            {name} +{v}%
          </span>
        </Tooltip>
      ))}
    </span>
  )
}

export default function ExpJourney({ char, history, dateCreate, breakdown, bonus, level, onLevel }) {
  /*
   * 고를 수 있는 레벨은 현재 레벨부터 299까지.
   * 지나온 레벨의 값은 볼 이유가 없다 — 목록만 길어진다.
   */
  const levelOptions = useMemo(() => {
    const from = char.character_level
    return Array.from({ length: Math.max(1, 300 - from) }, (_, i) => ({ value: from + i, label: `Lv.${from + i}` }))
  }, [char.character_level])
  const nowCum = char.character_level + char.exp_rate / 100

  // 렌더 중 시각 호출은 금지 → 최초 마운트 시 한 번만 고정
  const nowMs = useMemo(() => new Date().getTime(), [])

  const created = useMemo(() => (dateCreate ? new Date(dateCreate) : null), [dateCreate])
  const ageDays = created ? Math.max(1, Math.round((nowMs - created.getTime()) / 86400000)) : null
  const stats = useMemo(() => journeyStats(history, nowCum, nowMs), [history, nowCum, nowMs])

  // ── 차트 좌표 ── (계산은 ../journey 공용, 여기선 PC 크기만 정한다)
  // padR: 오늘 지점의 캐릭터 마커가 오른쪽 경계에 붙지 않도록 여백을 준다
  const V = { W: 1000, H: 300, padL: 56, padR: 64, padT: 56, padB: 52 }
  const { coords, now, gridLevels, line, area, Y } = chartGeometry({
    history,
    level: char.character_level,
    expRate: char.exp_rate,
    nowMs,
    V,
  })

  const [hover, setHover] = useState(null) // index into coords

  // 인게임 표기와 같게 소수 3자리
  const pct = (p) => `${p.toFixed(3)}%`
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
            {/* 배지는 데이터가 아니라 식별 정보다 — 아래 수치·차트가 쓰는 하늘색과 구분한다 */}
            <span
              className="text-[13px] font-bold tabular-nums text-white px-2.5 py-0.5 rounded-md shrink-0"
              style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))' }}
            >
              Lv.{char.character_level}
            </span>
          </div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {char.job_name}
            {created && <> · <span className="tabular-nums">{fmtDate(created).slice(0, 10).replace(/-/g, '.')}</span> 생성 <span style={{ color: 'var(--text-dim)' }}>({ageDays.toLocaleString()}일째)</span></>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>레벨</span>
          <div className="w-[116px]">
            <Select options={levelOptions} value={level} onChange={onLevel} />
          </div>
          {level !== char.character_level && (
            <button
              type="button"
              onClick={() => onLevel(null)}
              className="text-[12.5px] font-bold rounded-full px-2.5 py-1"
              style={{ background: 'var(--mpl-row)', color: 'var(--text-muted)' }}
            >
              현재 레벨로
            </button>
          )}
        </div>
      </div>

      {/* 적용 중인 보너스 */}
      <div className="mx-6 mb-3 flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-muted)' }}>적용 중인 보너스</span>
        <BonusChips bonus={bonus} />
      </div>

      {/* 통계 스트립 */}
      <div className="mx-6 mb-1.5 flex rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--panel-border)', background: 'linear-gradient(180deg, var(--mpl-row), var(--panel-bg))' }}>
        {/* 세 값이 전부 같은 색이면 한 덩어리로 보인다 — 성격이 다르니 색도 나눈다 */}
        <Stat label="현재 경험치" value={`${char.exp_rate.toFixed(3)}%`} color={C_DAY} />
        <div className="w-px my-3" style={{ background: 'var(--panel-border)' }} />
        <Stat label="최근 7일 획득" value={stats.week != null ? `+${stats.week.toFixed(1)}Lv` : '—'} color={C_WEEK} />
        <div className="w-px my-3" style={{ background: 'var(--panel-border)' }} />
        <Stat label="하루 평균 획득" value={stats.avg != null ? `+${(stats.avg * 100).toFixed(1)}%p` : '—'} color={C_PACE} />
      </div>

      {/* 차트 — 바깥 px-6로 위 통계 스트립과 좌우 경계를 맞추고,
           안쪽 relative 박스는 SVG와 정확히 같은 크기라 오버레이(%) 좌표가 어긋나지 않는다 */}
      <div className="px-6 pt-1">
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${V.W} ${V.H}`} className="w-full block overflow-visible">
          <defs>
            <linearGradient id="expfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--mpl-sky-from)" stopOpacity="0.3" />
              <stop offset="1" stopColor="var(--mpl-sky-from)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridLevels.map((lv) => (
            <g key={lv}>
              <line x1={V.padL} y1={Y(lv)} x2={V.W - V.padR} y2={Y(lv)} stroke="var(--row-divider)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={V.padL - 9} y={Y(lv)} dominantBaseline="middle" textAnchor="end" fontSize="14" fill="var(--text-dim)">
                Lv.{lv}
              </text>
            </g>
          ))}
          <path d={area} fill="url(#expfill)" />
          <path d={line} fill="none" stroke="var(--mpl-sky-to)" strokeWidth="2.5" strokeLinejoin="round" />
          {/* x축 날짜: 과거 전부 + 오늘 */}
          {coords.slice(0, -1).map((p) => (
            <text key={p.date} x={p.x} y={V.H - V.padB + 22} fontSize="14" fill="var(--text-dim)" textAnchor="middle">
              {mdLabel(p.date)}
            </text>
          ))}
          <text x={now.x} y={V.H - V.padB + 22} fontSize="14" fill="var(--accent-bright)" textAnchor="end" fontWeight="700">오늘</text>
          {/* 과거 점 (hover 대상) */}
          {coords.slice(0, -1).map((p, i) => (
            <g key={p.date}>
              <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="var(--panel-bg)" stroke="var(--mpl-sky-to)" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="16" fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
            </g>
          ))}
          {/* 오늘 점 — 마커는 아래 오버레이(pointer-events 없음)라 hover 영역만 여기 둔다 */}
          <circle cx={now.x} cy={now.y} r="16" fill="transparent"
            onMouseEnter={() => setHover(coords.length - 1)} onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer' }} />
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
          // 오늘 점 위에는 캐릭터가 서 있어서 툴팁이 가려진다 → 아래쪽으로 뺀다
          const below = !!p.isNow
          return (
            <div className="absolute pointer-events-none z-10 rounded-[10px] px-3 py-2 text-center whitespace-nowrap"
              style={{
                left: `calc(${(p.x * HXW).toFixed(2)}% )`,
                top: `calc(${(p.y * HYH).toFixed(2)}% ${below ? '+' : '-'} 12px)`,
                transform: `translate(-50%, ${below ? '0' : '-100%'})`,
                background: '#22303f', color: '#fff', boxShadow: '0 6px 16px rgba(31,44,61,.3)',
              }}>
              <div className="text-[12px] font-bold opacity-75">
                {p.date.replace(/-/g, '.')} ({WK_DAY[new Date(p.date).getDay()]}){p.isNow ? ' · 오늘' : ''}
              </div>
              <div className="text-[15px] font-bold tabular-nums leading-snug">
                Lv.{p.level} · {pct(p.exp_rate)}
              </div>
              {delta != null && <div className="text-[12px]" style={{ color: '#8fd8f5' }}>전일 대비 +{delta.toFixed(1)}%p</div>}
              <div className={`absolute left-1/2 -translate-x-1/2 ${below ? '-top-[6px]' : '-bottom-[6px]'}`} style={{
                width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                ...(below
                  ? { borderBottom: '6px solid #22303f' }
                  : { borderTop: '6px solid #22303f' }),
              }} />
            </div>
          )
        })()}

      </div>
      </div>

      {/* 하단 — 기여도 요약. 라벨을 값 앞에 나란히 둔다 (레벨은 위 드롭다운에 이미 있다) */}
      <div className="flex items-center border-t" style={{ borderColor: 'var(--row-divider)', background: 'var(--mpl-row)' }}>
        {[
          { label: '일일', value: breakdown.dailyTotal, color: C_DAY },
          { label: '주간', value: breakdown.weeklyTotal, color: C_WEEK },
          { label: '아이템', value: breakdown.onceTotal, color: C_ONCE },
        ].map((m, i) => (
          <div
            key={m.label}
            className={`flex-1 flex items-baseline justify-center gap-2.5 py-3.5 ${i > 0 ? 'border-l' : ''}`}
            style={{ borderColor: 'var(--panel-border)' }}
          >
            <span className="text-[15px] font-bold" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
            <span className="text-[19px] font-bold tabular-nums" style={{ color: m.color }}>{fmtPct(m.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
