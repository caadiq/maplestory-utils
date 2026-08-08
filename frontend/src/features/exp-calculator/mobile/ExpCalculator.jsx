import { useState, useRef, useMemo, useEffect, createContext, useContext } from 'react'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useExpStore, expInitialState } from '../store'
import { NumInput } from '../../../components/common/widgets'
import {
  EPIC_STAGES, defaultSettings, zoneOn,
  simulate, breakdown, fmtPct, weekKeyKST, parkSpecialActive,
} from '../logic'
import { WK_DAY, dateFrom, fmtDate, mdLabel, journeyStats, chartGeometry } from '../journey'

/**
 * 경험치 계산기 — 모바일.
 *
 * PC의 3열 카드를 한 열로 펴고, 카드 사이에 일일/주간/일회성 구분선을 넣는다.
 * 계산·아이콘·저장은 전부 PC와 공유(logic/journey/store)하고 배치와 크기만 다르다.
 * 결과(도달까지 며칠)는 스크롤해도 보이게 헤더 밑에 붙여둔다.
 */

const SKY = 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))'
const PUR = 'linear-gradient(180deg, var(--mpl-purple-from), var(--mpl-purple-to))'
const TAN = 'linear-gradient(180deg, #e6c976, #c8a34e)'
const QUEST = 'linear-gradient(180deg,#7cc7ea,#4da4d4)'
const C_DAY = 'var(--accent-bright)'
const C_WEEK = '#9247c9'
const C_ONCE = '#e8a20c'

const EPIC_ICON = { high_mountain: 'ed_highmountain', angler_company: 'ed_angler', nightmare_paradise: 'ed_nightmare' }
const PARK_ICON_PREFIX = {
  yeoro: 'arc', chewchew: 'arc', lacheln: 'arc', arcana: 'arc', morass: 'arc', esfera: 'arc',
  moonbridge: 'ten', maze: 'ten', limen: 'ten', sellas: 'mp',
  cernium: 'gra', arcs: 'gra', odium: 'gra', dowonkyung: 'gra', arteria: 'gra', carcion: 'gra', tallahart: 'gra',
}
const parkIconId = (id) => `${PARK_ICON_PREFIX[id]}_${id}`

/* ── 소품 (PC와 같은 문법, 모바일 치수) ── */

const IconCtx = createContext({})

function Ico({ id, size = 34 }) {
  const url = useContext(IconCtx)[id]
  return url
    ? <img src={url} alt="" className="object-contain shrink-0" style={{ width: size, height: size, imageRendering: 'pixelated' }} />
    : null
}

function MiniToggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="relative w-[33px] h-[21px] rounded-full shrink-0 transition-colors"
      style={{ background: on ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' : 'var(--toggle-off, #c3ced9)' }}>
      <span className="absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white transition-all"
        style={{ left: on ? 15 : 3, boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
    </button>
  )
}

/** 컨텐츠 카드 — 헤더(아이콘·제목·스위치) + 본문 + 맨 아래 합계 줄 */
function Card({ icon, grad, title, sub, pct, pctColor, totalLabel = '합계', toggle, onToggle, children }) {
  const off = toggle === false
  return (
    <div className="rounded-2xl border p-3.5"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
      <div className={`flex items-center gap-2.5 ${children ? 'mb-2.5' : ''}`}>
        <div className="w-[46px] h-[46px] rounded-xl shrink-0 flex items-center justify-center"
          style={{ background: grad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)', opacity: off ? 0.45 : 1 }}>
          <Ico id={icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold truncate">{title}</div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        {toggle != null && <MiniToggle on={toggle} onChange={onToggle} />}
      </div>
      {children}
      <div className="flex items-center justify-between pt-2 mt-2.5 border-t" style={{ borderColor: 'var(--row-divider)' }}>
        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{totalLabel}</span>
        <span className="text-[15.5px] font-bold tabular-nums" style={{ color: off ? 'var(--text-dim)' : pctColor }}>{pct}</span>
      </div>
    </div>
  )
}

/** 일퀘 지역 한 줄 — 스위치 + 지역 아이콘 + 이름 + 기여도 */
function ZoneRow({ icon, label, on, onToggle, value, color }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-t first:border-t-0 text-[13px]"
      style={{ borderColor: 'var(--row-divider)' }}>
      <MiniToggle on={on} onChange={onToggle} />
      <Ico id={icon} size={21} />
      <span className="truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="ml-auto tabular-nums font-medium shrink-0" style={{ color }}>{value}</span>
    </div>
  )
}

/** 2줄 행 — 윗줄: 아이콘 + 이름 + 입력 / 아랫줄: 단가 + 결과값 */
function TwoLineRow({ icon, label, control, note, value, valueColor, locked }) {
  return (
    <div className={`pt-2 border-t first:border-t-0 first:pt-0 ${locked ? 'opacity-45' : ''}`}
      style={{ borderColor: 'var(--row-divider)' }}>
      <div className="flex items-center gap-3">
        <Ico id={icon} size={22} />
        <span className="text-[13px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {!locked && <span className="ml-auto shrink-0">{control}</span>}
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{note}</span>
        <span className="text-[13px] tabular-nums font-medium" style={{ color: locked ? 'var(--text-dim)' : valueColor }}>
          {locked ? '—' : value}
        </span>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <span className="block text-[12.5px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

/** 칸을 꽉 채우는 숫자 입력 (그리드 안에서 폭을 맞춘다) */
function FullInput({ value, onChange, decimal, max }) {
  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={String(value ?? 0)}
      onChange={(e) => {
        if (decimal) {
          const v = e.target.value.replace(/[^\d.]/g, '')
          onChange(v === '' ? 0 : Math.min(parseFloat(v) || 0, max))
        } else {
          onChange(Math.min(parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0, max))
        }
      }}
      className="w-full h-[38px] rounded-md border px-3 text-[14.5px] text-right tabular-nums outline-none focus:border-[var(--input-border-focus)]"
      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
    />
  )
}

function SegFull({ options, value, onChange }) {
  return (
    <div className="flex w-full h-[38px] rounded-md overflow-hidden border text-[12.5px] font-bold"
      style={{ borderColor: 'var(--input-border)' }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className="flex-1 min-w-0 whitespace-nowrap"
          style={o.value === value
            ? { background: SKY, color: '#fff' }
            : { background: 'var(--input-bg)', color: 'var(--text-muted)' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 카드 묶음 구분선 — 일일 / 주간 / 일회성 */
function SecLabel({ children }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5 pt-1">
      <span className="text-[12.5px] font-bold tracking-wide" style={{ color: 'var(--text-muted)' }}>{children}</span>
      <i className="flex-1 h-px" style={{ background: 'var(--panel-border)' }} />
    </div>
  )
}

function GoalLevelInput({ value, onCommit, min, max }) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border px-3 h-[38px]"
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
        className="bg-transparent outline-none text-right font-bold tabular-nums text-[15px] pr-[3px]"
        style={{ width: '4.5ch', color: 'var(--text-strong)' }}
      />
      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>Lv</span>
    </div>
  )
}

function Stat({ label, value, color, sub }) {
  return (
    <div className="px-3 py-2.5 min-w-0">
      <div className="text-[12.5px] font-bold truncate" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[19px] font-bold tabular-nums leading-tight mt-0.5 truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] truncate" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

/**
 * 등반 차트 — PC와 같은 좌표 계산(../journey)에 모바일 크기만 다르게.
 * 손가락엔 hover가 없으니 점을 탭하면 툴팁이 뜨고 다시 탭하면 닫힌다.
 */
const CHART_DAYS = 5

function Chart({ char, history, result, nowMs, goalDateObj }) {
  /*
   * 라벨 크기는 viewBox 축소배율(폭 296/400 = 0.74)이 곱해져 화면에 그려진다.
   * 실제 12.5~13px로 보이려면 여기서는 17 안팎을 줘야 한다.
   * padL·padB는 그 커진 글자가 들어갈 자리다.
   */
  const V = { W: 400, H: 310, padL: 42, padR: 0, padT: 46, padB: 54 }
  /*
   * 폭이 좁아 9일치를 다 그리면 점 간격이 19px밖에 안 돼 날짜를 하나 걸러 하나만 찍어야 했다.
   * 최근 며칠만 그리면 간격이 37px로 벌어져 날짜를 전부 넣고도 글자·차트를 키울 수 있다.
   * (통계의 '최근 7일 획득' 등은 자른 적 없는 전체 history를 그대로 쓴다)
   */
  const hist = history.slice(-CHART_DAYS)
  const { coords, now, tgx, tgy, gridLevels, line, area, proj, projFill, Y } =
    chartGeometry({ history: hist, level: char.character_level, expRate: char.exp_rate, targetLevel: result.target, nowMs, V, histSpan: 0.70 })
  const [tip, setTip] = useState(null)
  const reachable = result.days != null
  const HXW = 100 / V.W
  const HYH = 100 / V.H
  const baseY = V.H - V.padB

  const p = tip != null ? coords[tip] : null
  const prev = tip != null ? coords[tip - 1] : null
  const delta = p && prev ? (p.cum - prev.cum) * 100 : null
  // 오늘 점 위에는 캐릭터가 서 있어서 툴팁을 아래로 뺀다 (PC와 동일)
  const below = !!p?.isNow

  return (
    <div className="relative mt-2.5">
      <svg viewBox={`0 0 ${V.W} ${V.H}`} className="w-full block overflow-visible" onClick={() => setTip(null)}>
        <defs>
          <linearGradient id="mexpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--mpl-sky-from)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--mpl-sky-from)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="mprojfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0a828" stopOpacity="0.15" />
            <stop offset="1" stopColor="#f0a828" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {gridLevels.map((lv) => (
          <g key={lv}>
            <line x1={V.padL} y1={Y(lv)} x2={V.W - V.padR} y2={Y(lv)} stroke="var(--row-divider)" strokeWidth="1" strokeDasharray="3 4" />
            <text x={V.padL - 9} y={Y(lv)} dominantBaseline="middle" textAnchor="end" fontSize="17.5" fill="var(--text-dim)">{lv}</text>
          </g>
        ))}
        {reachable && <path d={projFill} fill="url(#mprojfill)" />}
        <path d={area} fill="url(#mexpfill)" />
        <path d={line} fill="none" stroke="var(--mpl-sky-to)" strokeWidth="2" strokeLinejoin="round" />
        {reachable && <path d={proj} fill="none" stroke="#f0a828" strokeWidth="2" strokeDasharray="5 4" />}

        {/* x축 — 날짜를 줄인 만큼 전부 표시한다 */}
        {coords.slice(0, -1).map((c) => (
          <text key={c.date} x={c.x} y={baseY + 24} fontSize="17" fill="var(--text-dim)" textAnchor="middle">{mdLabel(c.date)}</text>
        ))}
        <text x={now.x} y={baseY + 24} fontSize="17" fill="var(--accent-bright)" textAnchor="middle" fontWeight="700">오늘</text>
        {goalDateObj && (
          <text x={tgx} y={baseY + 24} fontSize="17" fill="#c8890f" textAnchor="end" fontWeight="700">
            {goalDateObj.getMonth() + 1}/{goalDateObj.getDate()}
          </text>
        )}

        {coords.slice(0, -1).map((c, i) => (
          <circle key={c.date} cx={c.x} cy={c.y} r={tip === i ? 5 : 3.2} fill="var(--panel-bg)" stroke="var(--mpl-sky-to)" strokeWidth="2" />
        ))}
        {reachable && <circle cx={tgx} cy={tgy} r="6" fill="#f0a828" stroke="var(--panel-bg)" strokeWidth="3" />}
        {reachable && result.days > 0 && (
          /* 중점에 두면 캐릭터에 물린다 — 예측 구간이 짧아 목표 쪽으로 밀어둔다 */
          <text x={now.x + (tgx - now.x) * 0.68} y={now.y + (tgy - now.y) * 0.68 - 10}
            fontSize="16.5" fill="#c8890f" textAnchor="middle" fontWeight="700">
            예상 +{result.days}일
          </text>
        )}
        {/* 탭 영역은 맨 위에 (점보다 넉넉하게) */}
        {coords.map((c, i) => (
          <circle key={`hit-${c.date}`} cx={c.x} cy={c.y} r="13" fill="transparent"
            onClick={(e) => { e.stopPropagation(); setTip(tip === i ? null : i) }} />
        ))}
      </svg>

      {/* 현재 캐릭터 마커 */}
      <div className="absolute pointer-events-none" style={{
        left: `calc(${(now.x * HXW).toFixed(2)}% - 32px)`,
        top: `calc(${(now.y * HYH).toFixed(2)}% - 70px)`,
        width: 64, height: 64, overflow: 'hidden', filter: 'drop-shadow(0 2px 3px rgba(31,44,61,.25))',
      }}>
        {char.character_image && (
          <img src={char.character_image} alt="" className="w-full h-full object-contain scale-[2.4] -translate-y-[3%]" style={{ imageRendering: 'pixelated' }} />
        )}
      </div>
      <div className="absolute pointer-events-none" style={{
        left: `calc(${(now.x * HXW).toFixed(2)}% - 6px)`,
        top: `calc(${(now.y * HYH).toFixed(2)}% - 13px)`,
        width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--accent-bright)',
      }} />
      <div className="absolute rounded-full pointer-events-none" style={{
        left: `calc(${(now.x * HXW).toFixed(2)}% - 6px)`,
        top: `calc(${(now.y * HYH).toFixed(2)}% - 6px)`,
        width: 12, height: 12, background: 'var(--accent-bright)', border: '2.5px solid var(--panel-bg)',
      }} />

      {p && (
        <div className="absolute pointer-events-none z-10 rounded-[10px] px-2.5 py-1.5 text-center whitespace-nowrap"
          style={{
            left: `calc(${(p.x * HXW).toFixed(2)}% )`,
            top: `calc(${(p.y * HYH).toFixed(2)}% ${below ? '+' : '-'} 10px)`,
            transform: `translate(-50%, ${below ? '0' : '-100%'})`,
            background: '#22303f', color: '#fff', boxShadow: '0 6px 16px rgba(31,44,61,.3)',
          }}>
          <div className="text-[12px] font-bold opacity-75">
            {p.date.replace(/-/g, '.')} ({WK_DAY[new Date(p.date).getDay()]}){p.isNow ? ' · 오늘' : ''}
          </div>
          <div className="text-[13.5px] font-bold tabular-nums leading-snug">Lv.{p.level} · {p.exp_rate.toFixed(1)}%</div>
          {delta != null && <div className="text-[12px]" style={{ color: '#8fd8f5' }}>전일 대비 +{delta.toFixed(1)}%p</div>}
          <div className={`absolute left-1/2 -translate-x-1/2 ${below ? '-top-[5px]' : '-bottom-[5px]'}`} style={{
            width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            ...(below ? { borderBottom: '5px solid #22303f' } : { borderTop: '5px solid #22303f' }),
          }} />
        </div>
      )}
    </div>
  )
}

/* ── 페이지 ── */

export default function MobileExpCalculator() {
  const { hydrated } = useFeatureSync({ feature: 'exp-calculator', store: useExpStore, initial: expInitialState })
  const characters = useExpStore((s) => s.characters)
  const selectedName = useExpStore((s) => s.selectedName)
  const allSettings = useExpStore((s) => s.settings)
  const addCharacter = useExpStore((s) => s.addCharacter)
  const removeCharacter = useExpStore((s) => s.removeCharacter)
  const setCharacters = useExpStore((s) => s.setCharacters)
  const selectCharacter = useExpStore((s) => s.selectCharacter)
  const patchSettings = useExpStore((s) => s.patchSettings)

  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const addAnchorRef = useRef(null)

  const { data } = useQuery({
    queryKey: ['exp', 'data'],
    queryFn: () => api('/api/exp/data'),
    staleTime: Infinity,
  })

  // 이번 주 스페셜 썬데이 여부 — 자동으로 켜지 않고 토글 옆에 힌트만 (PC와 동일)
  const { data: sunday } = useQuery({
    queryKey: ['sunday-maple', 'current'],
    queryFn: () => api('/api/sunday-maple/current'),
    staleTime: 30 * 60 * 1000,
  })
  const sundaySpecialWeek = sunday?.available && sunday.variant === 'special'

  const searchMutation = useMutation({
    mutationFn: (name) => api(`/api/exp/lookup?name=${encodeURIComponent(name)}`),
    onSuccess: (res) => {
      setAddError('')
      setAddName('')
      addCharacter({ ...res.character, exp_rate: res.exp_rate })
    },
    onError: (err) => setAddError(err.message || '조회 실패'),
  })

  const { data: lookup } = useQuery({
    queryKey: ['exp', 'lookup', selectedName],
    queryFn: async () => {
      const res = await api(`/api/exp/lookup?name=${encodeURIComponent(selectedName)}`)
      try { localStorage.setItem(`maple.exp.data.${selectedName}`, JSON.stringify(res)) } catch { /* noop */ }
      return res
    },
    enabled: hydrated && !!selectedName,
    staleTime: 10 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
    initialData: () => {
      try { return JSON.parse(localStorage.getItem(`maple.exp.data.${selectedName}`)) || undefined } catch { return undefined }
    },
    initialDataUpdatedAt: 0,
  })

  useEffect(() => {
    if (!lookup?.character) return
    setCharacters((chars) => chars.map((c) => (
      c.character_name === lookup.character.character_name
        ? { ...c, ...lookup.character, id: c.id, exp_rate: lookup.exp_rate }
        : c
    )))
  }, [lookup]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault()
    const n = addName.trim()
    if (n) searchMutation.mutate(n)
  }

  const stored = characters.find((c) => c.character_name === selectedName) || null
  const fresh = lookup?.character?.character_name === selectedName ? lookup : null
  const char = useMemo(
    () => (stored && fresh
      ? { ...stored, ...fresh.character, id: stored.id, exp_rate: fresh.exp_rate }
      : stored),
    [stored, fresh],
  )
  const history = useMemo(() => fresh?.history || [], [fresh])
  const dateCreate = fresh?.date_create || null

  const weekKey = weekKeyKST(new Date())
  const rawSettings = (char && allSettings[char.id]) || defaultSettings(char?.character_level || 260)
  const s = useMemo(() => {
    const p = rawSettings.weekly.park
    const active = parkSpecialActive(p, weekKey)
    if (active === !!p.sundaySpecial) return rawSettings
    return { ...rawSettings, weekly: { ...rawSettings.weekly, park: { ...p, sundaySpecial: active } } }
  }, [rawSettings, weekKey])
  const patch = (p) => char && patchSettings(char.id, p)
  const patchDeep = (key, p) => patch((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }))

  const bd = useMemo(() => (data && char ? breakdown(data, char, s) : null), [data, char, s])

  const goal = s.goal
  const result = useMemo(() => {
    if (!data || !char) return null
    const t = Math.max(char.character_level + 1, Math.min(goal.level || char.character_level + 1, 300))
    const sim = simulate(data, char, s, { targetLevel: t })
    return { target: t, days: sim.days }
  }, [data, char, s, goal])

  // 렌더 중 시각 호출은 금지 → 최초 마운트 시 한 번만 고정
  const nowMs = useMemo(() => new Date().getTime(), [])
  const created = dateCreate ? new Date(dateCreate) : null
  const ageDays = created ? Math.max(1, Math.round((nowMs - created.getTime()) / 86400000)) : null
  const level = char?.character_level || 0
  const stats = useMemo(
    () => journeyStats(history, level + (char?.exp_rate || 0) / 100, nowMs),
    [history, level, char?.exp_rate, nowMs],
  )
  const goalDateObj = result?.days != null ? dateFrom(nowMs, result.days) : null

  const icons = data?.icons || {}
  if (!hydrated || !data) return null

  const zoneGroups = [
    { key: 'arcane', title: '아케인리버 일일퀘스트', icon: 'arc_esfera' },
    { key: 'tenebris', title: '테네브리스 일일퀘스트', icon: 'ten_limen' },
    { key: 'grandis', title: '그란디스 일일퀘스트', icon: 'gra_carcion' },
  ]

  return (
    <IconCtx.Provider value={icons}>
      <MapleWindow title="EXP CALCULATOR" bodyClassName="space-y-2.5">

        {/* 캐릭터 */}
        <div className="rounded-2xl border p-3"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div ref={addAnchorRef} className="relative flex-1 min-w-0">
              <input
                type="text"
                value={addName}
                onChange={(e) => { setAddName(e.target.value); if (addError) setAddError('') }}
                onFocus={() => setDropdownOpen(true)}
                onClick={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder="캐릭터 닉네임 검색"
                className="w-full h-[42px] rounded-full border px-4 text-[13.5px] outline-none focus:border-[var(--input-border-focus)]"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
              />
              <CharacterSuggestDropdown
                open={dropdownOpen}
                filter={addName}
                anchorRef={addAnchorRef}
                excludeNames={characters.map((c) => c.character_name)}
                onSelect={(n) => { setAddName(n); setDropdownOpen(false); setAddError(''); searchMutation.mutate(n) }}
              />
            </div>
            <button type="submit" disabled={searchMutation.isPending}
              className="shrink-0 rounded-full px-5 h-[42px] text-[13.5px] font-bold disabled:opacity-50"
              style={{ background: SKY, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.3)' }}>
              {searchMutation.isPending ? '...' : '조회'}
            </button>
          </form>
          {addError && <p className="mt-2 text-[13px]" style={{ color: 'var(--danger-text)' }}>{addError}</p>}

          {/* 캐릭터 칩 — 다른 모바일 페이지와 같은 문법 */}
          {characters.length > 0 && (
            <div className="-mx-3 mt-2.5">
              <OverlayScrollbarsComponent
                options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
                defer
              >
                <div className="flex w-max gap-2.5 px-3 pt-0.5 pb-2">
                  {characters.map((c) => {
                    const active = c.character_name === selectedName
                    return (
                      <button key={c.id || c.character_name} type="button"
                        onClick={() => selectCharacter(c.character_name)}
                        className="relative shrink-0 rounded-2xl border p-3 pr-9 text-left active:scale-[0.98] transition-transform"
                        style={active
                          ? { background: 'var(--mpl-card)', borderColor: 'transparent', boxShadow: 'inset 0 0 0 2px var(--selected-border), 0 3px 10px rgba(134,201,62,.25)' }
                          : { background: 'var(--mpl-card)', borderColor: 'transparent', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--surface-nested)' }}>
                            {c.character_image
                              ? <img src={c.character_image} alt="" className="w-full h-full object-contain scale-[2.1] origin-center select-none" style={{ imageRendering: 'pixelated' }} draggable={false} loading="lazy" decoding="async" />
                              : <span className="text-2xl" style={{ color: 'var(--text-dim)' }}>?</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              {c.world_icon && <img src={c.world_icon} alt="" className="w-5 h-5 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />}
                              <div className="text-base font-semibold truncate max-w-[9rem]" style={{ color: active ? 'var(--accent-bright)' : 'var(--text-strong)' }}>{c.character_name}</div>
                            </div>
                            <div className="text-xs truncate max-w-[9rem] mt-0.5" style={{ color: 'var(--text-dim)' }}>Lv.{c.character_level} · {c.job_name}</div>
                          </div>
                        </div>
                        <span role="button" tabIndex={-1}
                          onClick={(e) => { e.stopPropagation(); setConfirmRemove(c) }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full text-sm"
                          style={{ color: 'var(--text-dim)' }}>×</span>
                      </button>
                    )
                  })}
                </div>
              </OverlayScrollbarsComponent>
            </div>
          )}
          {characters.length === 0 && (
            <p className="py-6 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
              캐릭터를 조회하면 목표 레벨까지<br />걸리는 시간을 계산합니다
            </p>
          )}
        </div>

        {/* 캐릭터 여정 */}
        {char && bd && result && (
          <div className="rounded-2xl border p-3.5 pb-0 overflow-hidden"
            style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-center gap-1.5">
              {char.world_icon && <img src={char.world_icon} alt="" className="w-[19px] h-[19px] object-contain" style={{ imageRendering: 'pixelated' }} />}
              <span className="text-[18px] font-bold truncate">{char.character_name}</span>
              <span className="text-[12px] font-bold tabular-nums text-white px-2 py-0.5 rounded-md shrink-0" style={{ background: SKY }}>Lv.{level}</span>
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {char.job_name}
              {created && <> · <span className="tabular-nums">{fmtDate(created).slice(0, 10).replace(/-/g, '.')}</span> 생성 <span style={{ color: 'var(--text-dim)' }}>({ageDays.toLocaleString()}일째)</span></>}
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>목표 레벨</span>
              <span className="ml-auto">
                <GoalLevelInput value={goal.level || level + 1} onCommit={(v) => patchDeep('goal', { level: v })} min={level + 1} max={300} />
              </span>
            </div>

            <div className="grid grid-cols-2 mt-2.5 rounded-xl border overflow-hidden [&>*]:border-[var(--panel-border)] [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(odd)]:border-r"
              style={{ borderColor: 'var(--panel-border)', background: 'linear-gradient(180deg, var(--mpl-row), var(--panel-bg))' }}>
              <Stat label="현재 경험치" value={`${char.exp_rate.toFixed(3)}%`} color={C_DAY} sub={`Lv.${level} 진행 중`} />
              <Stat label="최근 7일 획득" value={stats.week != null ? `+${stats.week.toFixed(1)}Lv` : '—'} color={C_DAY} sub={`목표 Lv.${result.target}`} />
              <Stat label="하루 평균 획득" value={stats.avg != null ? `+${(stats.avg * 100).toFixed(1)}%p` : '—'} color={C_DAY} sub="실측 페이스" />
              <Stat label="목표 도달 예상" value={goalDateObj ? `${goalDateObj.getMonth() + 1}.${goalDateObj.getDate()} (${WK_DAY[goalDateObj.getDay()]})` : '—'} color={C_ONCE}
                sub={result.days != null ? `약 ${result.days.toLocaleString()}일 후` : '현재 페이스론 불가'} />
            </div>

            <Chart char={char} history={history} result={result} nowMs={nowMs} goalDateObj={goalDateObj} />

            {/* 기여도 요약 */}
            <div className="flex -mx-3.5 mt-2 border-t" style={{ borderColor: 'var(--row-divider)', background: 'var(--mpl-row)' }}>
              {[
                { label: '일일', value: bd.dailyTotal, color: C_DAY },
                { label: '주간', value: bd.weeklyTotal, color: C_WEEK },
                { label: '일회성', value: bd.onceTotal, color: C_ONCE },
              ].map((m) => (
                <div key={m.label} className="flex-1 text-center py-2.5">
                  <div className="text-[12.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                  <div className="text-[15px] font-bold tabular-nums" style={{ color: m.color }}>{fmtPct(m.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {char && bd && (
          <>
            {/* ── 일일 ── */}
            <SecLabel>일일 컨텐츠</SecLabel>

            <Card icon="hunt" grad={PUR} title="사냥" sub="1소재 = 30분"
              pct={fmtPct(bd.hunt)} pctColor={C_WEEK} totalLabel="일일 합계">
              <div className="grid grid-cols-2 gap-2">
                <Field label="1소재당 획득 (%)">
                  <FullInput value={s.hunt.pctPerRun} decimal max={100} onChange={(v) => patchDeep('hunt', { pctPerRun: v })} />
                </Field>
                <Field label="하루 소재 수">
                  <FullInput value={s.hunt.runsPerDay} max={48} onChange={(v) => patchDeep('hunt', { runsPerDay: v })} />
                </Field>
              </div>
            </Card>

            {zoneGroups.map((g) => {
              const open = data.daily[g.key].filter((z) => level >= z.minLevel)
              const on = open.filter((z) => zoneOn(s.daily, z.id)).length
              return (
                <Card key={g.key} icon={g.icon} grad={QUEST} title={g.title}
                  sub={`${on}/${open.length} 지역 선택됨`} pct={fmtPct(bd.zones[`${g.key}Total`])} pctColor={C_DAY}>
                  <div>
                    {open.map((z) => {
                      const zb = bd.zones[z.id]
                      return (
                        <ZoneRow key={z.id}
                          icon={`${g.key === 'arcane' ? 'arc' : g.key === 'tenebris' ? 'ten' : 'gra'}_${z.id}`}
                          label={z.name}
                          on={zb.on}
                          onToggle={(v) => patch((prev) => ({ ...prev, daily: { ...prev.daily, [z.id]: v } }))}
                          value={fmtPct(zb.pct)}
                          color={zb.on ? C_DAY : 'var(--text-dim)'}
                        />
                      )
                    })}
                  </div>
                </Card>
              )
            })}

            {/* 몬파는 매일 도는 컨텐츠 — 일요일 보너스 때문에 주 단위로 계산해 하루 평균으로 보여준다 */}
            <Card icon="mp" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="몬스터파크"
              sub="일 2회 무료 · 최대 7회" pct={fmtPct(bd.park.total)} pctColor={C_WEEK} totalLabel="일 평균">
              <div className="grid grid-cols-[3fr_2fr] gap-2">
                <Field label="지역">
                  <Select
                    value={bd.park.zone?.id || ''}
                    onChange={(v) => patchDeep('weekly', { park: { ...s.weekly.park, zone: v } })}
                    options={data.monsterPark.zones.filter((z) => level >= z.minLevel)
                      .map((z) => ({ value: z.id, label: z.name, subIcon: icons[parkIconId(z.id)] })).reverse()}
                  />
                </Field>
                <Field label="일일 횟수">
                  <FullInput value={s.weekly.park.runs} max={7}
                    onChange={(v) => patchDeep('weekly', { park: { ...s.weekly.park, runs: v } })} />
                </Field>
              </div>
              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t text-[13px]" style={{ borderColor: 'var(--row-divider)' }}>
                <MiniToggle on={!!s.weekly.park.sundaySpecial}
                  onChange={(v) => patchDeep('weekly', { park: { ...s.weekly.park, sundaySpecial: v, sundaySpecialWeek: v ? weekKey : null } })} />
                <span style={{ color: 'var(--text-muted)' }}>스페셜 썬데이</span>
                {sundaySpecialWeek && <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>이번 주</span>}
                <span className="ml-auto tabular-nums font-medium"
                  style={{ color: s.weekly.park.sundaySpecial ? C_WEEK : 'var(--text-dim)' }}>
                  {s.weekly.park.sundaySpecial ? '일요일 400%' : '일요일 150%'}
                </span>
              </div>
            </Card>

            {/* ── 주간 ── */}
            <SecLabel>주간 컨텐츠</SecLabel>

            <Card icon="sauna" grad={PUR} title="리조트 · 사우나" sub="잠수 경험치"
              pct={fmtPct(bd.mvp + bd.vip)} pctColor={C_WEEK}>
              <div>
                <TwoLineRow icon="sauna" label="MVP 리조트" note={`1시간당 ${fmtPct(bd.saunaHourPct)}`}
                  control={<NumInput value={s.weekly.mvpHours} onChange={(v) => patchDeep('weekly', { mvpHours: v })} min={0} max={99} chars={3} unit="시간/주" />}
                  value={fmtPct(bd.mvp)} valueColor={C_WEEK} />
                <TwoLineRow icon="sauna_vip" label="VIP 사우나 이용권" note={`1개(30분)당 ${fmtPct(bd.vipOne)}`}
                  control={<NumInput value={s.items.vipTickets} onChange={(v) => patchDeep('items', { vipTickets: v })} min={0} max={999} chars={3} unit="개" />}
                  value={fmtPct(bd.vip)} valueColor={C_WEEK} />
              </div>
            </Card>

            <Card icon="mp_extreme" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="익스트림 몬스터파크"
              sub={bd.extreme.locked ? 'Lv.260 필요' : '주간 1회 · 목요일 초기화'}
              pct={fmtPct(bd.extreme.total)} pctColor={C_WEEK} totalLabel="주간 합계"
              toggle={!!s.weekly.extreme.on} onToggle={(v) => patchDeep('weekly', { extreme: { on: v } })} />

            <Card icon="ed_nightmare" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="에픽던전"
              sub="주간 1회 · 목요일 초기화" pct={fmtPct(bd.epic.total)} pctColor={C_WEEK} totalLabel="주간 합계"
              toggle={s.weekly.epic.on} onToggle={(v) => patchDeep('weekly', { epic: { ...s.weekly.epic, on: v } })}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="던전">
                  <Select
                    value={s.weekly.epic.dungeon}
                    onChange={(v) => patchDeep('weekly', { epic: { ...s.weekly.epic, dungeon: v } })}
                    options={data.epicDungeon.dungeons.map((d) => ({
                      value: d.id,
                      label: level >= d.minLevel ? d.name : `${d.name} (Lv.${d.minLevel})`,
                      subIcon: icons[EPIC_ICON[d.id]],
                    }))}
                  />
                </Field>
                <Field label="보상">
                  <SegFull options={EPIC_STAGES} value={s.weekly.epic.stage}
                    onChange={(v) => patchDeep('weekly', { epic: { ...s.weekly.epic, stage: v } })} />
                </Field>
              </div>
            </Card>

            {/* ── 일회성 ── */}
            <SecLabel>일회성 아이템</SecLabel>

            <Card icon="elixir" grad={TAN} title="성장의 비약" sub="일회성 소모"
              pct={fmtPct(bd.elixir + bd.e200 + bd.e250)} pctColor={C_ONCE}>
              <div>
                {data.elixirs.map((e) => (
                  <TwoLineRow key={e.id} icon={`elixir_${e.id}`} label={e.name} note={`1개당 ${fmtPct(bd.elixirOne[e.id])}`}
                    control={<NumInput value={s.items.elixirCounts?.[e.id] || 0}
                      onChange={(v) => patchDeep('items', { elixirCounts: { ...s.items.elixirCounts, [e.id]: v } })}
                      min={0} max={999} chars={3} unit="개" />}
                    value={fmtPct(bd.elixirEach[e.id])} valueColor={C_ONCE} />
                ))}
                <TwoLineRow icon="elixir200" label="200레벨 달성의 비약" note={`1개당 ${fmtPct(bd.e200One)}`}
                  control={<NumInput value={s.items.e200lv} onChange={(v) => patchDeep('items', { e200lv: v })} min={0} max={999} chars={3} unit="개" />}
                  value={fmtPct(bd.e200)} valueColor={C_ONCE} />
                <TwoLineRow icon="elixir250" label="250레벨 달성의 비약" note={`1개당 ${fmtPct(bd.e250One)}`}
                  control={<NumInput value={s.items.e250lv} onChange={(v) => patchDeep('items', { e250lv: v })} min={0} max={999} chars={3} unit="개" />}
                  value={fmtPct(bd.e250)} valueColor={C_ONCE} />
              </div>
            </Card>

            <Card icon="coupon" grad={TAN} title="EXP 교환권" sub="일회성 소모"
              pct={fmtPct(bd.couponN + bd.couponU)} pctColor={C_ONCE}>
              <div>
                <TwoLineRow icon="coupon" label="EXP 교환권" note={`1개당 ${fmtPct(bd.couponNOne)}`}
                  control={<NumInput value={s.items.couponNormal} onChange={(v) => patchDeep('items', { couponNormal: v })} min={0} max={99999} chars={5} unit="개" />}
                  value={fmtPct(bd.couponN)} valueColor={C_ONCE} />
                <TwoLineRow icon="coupon_up" label="상급 EXP 교환권" note={`1개당 ${fmtPct(bd.couponUOne)}`}
                  control={<NumInput value={s.items.couponUpper} onChange={(v) => patchDeep('items', { couponUpper: v })} min={0} max={99999} chars={5} unit="개" />}
                  value={fmtPct(bd.couponU)} valueColor={C_ONCE} />
              </div>
            </Card>

            <Card icon="farm_mech" grad={TAN} title="농장" sub="입장권 소모"
              pct={fmtPct(bd.golden.total + bd.blue.total + bd.mech.total)} pctColor={C_ONCE}>
              <div>
                <TwoLineRow icon="farm_gold" label="황금 딸기 농장" locked={bd.golden.locked}
                  note={bd.golden.locked ? '최대 레벨 초과' : `1회당 ${fmtPct(bd.golden.one)}`}
                  control={<NumInput value={s.items.farmGolden} onChange={(v) => patchDeep('items', { farmGolden: v })} min={0} max={999} chars={3} unit="회" />}
                  value={fmtPct(bd.golden.total)} valueColor={C_ONCE} />
                <TwoLineRow icon="farm_blue" label="블루베리 농장" locked={bd.blue.locked}
                  note={bd.blue.locked ? `Lv.${data.farms.blue.minLevel} 필요` : `1회당 ${fmtPct(bd.blue.one)}`}
                  control={<NumInput value={s.items.farmBlue} onChange={(v) => patchDeep('items', { farmBlue: v })} min={0} max={999} chars={3} unit="회" />}
                  value={fmtPct(bd.blue.total)} valueColor={C_ONCE} />
                <TwoLineRow icon="farm_mech" label="메카베리 농장" locked={bd.mech.locked}
                  note={bd.mech.locked ? `Lv.${data.farms.mech.minLevel} 필요` : `1회당 ${fmtPct(bd.mech.one)}`}
                  control={<NumInput value={s.items.farmMech} onChange={(v) => patchDeep('items', { farmMech: v })} min={0} max={999} chars={3} unit="회" />}
                  value={fmtPct(bd.mech.total)} valueColor={C_ONCE} />
              </div>
            </Card>
          </>
        )}
      </MapleWindow>

      <ConfirmDialog
        open={!!confirmRemove}
        title="캐릭터 삭제"
        description={confirmRemove ? `${confirmRemove.character_name} 캐릭터를 목록에서 삭제할까요?` : ''}
        confirmText="삭제"
        destructive
        onConfirm={() => { removeCharacter(confirmRemove.character_name); setConfirmRemove(null) }}
        onClose={() => setConfirmRemove(null)}
      />
    </IconCtx.Provider>
  )
}
