import { useState, useMemo, useLayoutEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../hooks/useAuth'
import { useLayout } from '../../../components/pc/Layout'
import { useBackClose } from '../../../hooks/useBackClose'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
import PageLoader from '../../../components/common/PageLoader'
import Select from '../../../components/common/Select'
import DatePicker from '../../../components/common/DatePicker'
import {
  todayKST, daysAgoKST, formatKoreanMeso, formatTime,
  sfResult, sfCost, flagApplied, groupStarforce, starforceSummary,
  normalizePotential, groupPotential, potentialSummary, potentialCost, isGradeUp, rowCeiling, GRADE_COLOR,
} from '../logic'

const PILL_ACTIVE = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)',
  color: '#ffffff',
}
const PILL_GHOST = {
  background: 'var(--mpl-card)',
  boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)',
  color: 'var(--text-muted)',
}

const BADGE = {
  success: { label: '성공', style: { background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))', color: '#fff' } },
  fail: { label: '실패', style: { background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)', color: '#5c6b7a' } },
  destroy: { label: '파괴', style: { background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))', color: '#fff' } },
}

function SummaryCard({ label, value, sub, color, ring }) {
  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{ background: 'var(--mpl-card)', boxShadow: ring ? `inset 0 0 0 2px ${ring}` : 'inset 0 0 0 1px var(--mpl-card-line)' }}
    >
      <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: color || 'var(--text-strong)' }}>
        {value}
        {sub && <span className="text-xs ml-1" style={{ color: 'var(--text-dim)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function ItemIcon({ url, size = 40 }) {
  if (!url) {
    return (
      <span
        className="rounded-lg flex items-center justify-center shrink-0"
        style={{ width: size, height: size, background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-dim)', fontSize: size * 0.4 }}
      >
        ?
      </span>
    )
  }
  return (
    <span
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        style={{ width: size * 0.8, height: size * 0.8, objectFit: 'contain', imageRendering: 'pixelated', filter: 'drop-shadow(0 0 1px rgba(1,0,0,.5))' }}
      />
    </span>
  )
}

/** 비용 브레이크다운 호버 툴팁 (재설정/감정/합계 정렬) */
function CostBreakdown({ resetCost, feeCost, total, children }) {
  if (!total || total <= 0) return children
  return (
    <span className="relative group/cost inline-block">
      {children}
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/cost:block z-20 w-52 rounded-xl p-3 text-left"
        style={{
          background: 'var(--popup-bg)',
          boxShadow: 'var(--popup-shadow), inset 0 0 0 1px var(--popup-border)',
        }}
      >
        <span className="flex items-center justify-between text-xs py-0.5">
          <span style={{ color: 'var(--text-muted)' }}>잠재 재설정</span>
          <b className="tabular-nums" style={{ color: 'var(--text-strong)' }}>{formatKoreanMeso(resetCost)}</b>
        </span>
        <span className="flex items-center justify-between text-xs py-0.5">
          <span style={{ color: 'var(--text-muted)' }}>큐브 감정</span>
          <b className="tabular-nums" style={{ color: 'var(--text-strong)' }}>{formatKoreanMeso(feeCost)}</b>
        </span>
        <span
          className="flex items-center justify-between text-xs pt-1.5 mt-1 border-t"
          style={{ borderColor: 'var(--popup-border)' }}
        >
          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>합계</span>
          <b className="tabular-nums text-[13px]" style={{ color: '#c9862a' }}>{formatKoreanMeso(total)}</b>
        </span>
      </span>
    </span>
  )
}

function GradeText({ grade }) {
  if (!grade) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  return <span style={{ color: GRADE_COLOR[grade] || 'var(--text-strong)' }}>{grade}</span>
}

function MethodBadge({ row }) {
  return row.method === 'cube' ? (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ background: 'linear-gradient(180deg, #ffd76e, #f0a828)', color: '#6b4b00' }}
    >
      {row.methodName}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)', color: '#3d4a58' }}
    >
      메소 재설정
    </span>
  )
}

function KindBadge({ kind }) {
  return kind === 'additional' ? (
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: 'linear-gradient(180deg, #c98fd8, #a86bc0)' }}>에디셔널</span>
  ) : (
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: 'linear-gradient(180deg, #8f9fe0, #7583cf)' }}>잠재</span>
  )
}

function CostText({ cost }) {
  if (cost == null) return <span className="text-xs" style={{ color: 'var(--text-dim)' }}>-</span>
  if (typeof cost === 'object') {
    return (
      <span className="tabular-nums whitespace-nowrap">
        {cost.discounted && (
          <span className="text-[11px] line-through mr-1.5" style={{ color: 'var(--text-dim)' }}>{formatKoreanMeso(cost.base)}</span>
        )}
        <span className="text-sm font-bold" style={{ color: '#c9862a' }}>{formatKoreanMeso(cost.final)}</span>
      </span>
    )
  }
  return <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: '#c9862a' }}>{formatKoreanMeso(cost)}</span>
}

/** 옵션 3줄 (등급색) */
function OptionBox({ options, highlight }) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs leading-relaxed"
      style={{
        background: 'var(--mpl-row)',
        boxShadow: highlight ? 'inset 0 0 0 1.5px #8fc7e8' : 'inset 0 0 0 1px var(--mpl-card-line)',
      }}
    >
      {(options || []).map((o, i) => (
        <div key={i} style={{ color: GRADE_COLOR[o.grade] || 'var(--text-muted)' }}>{o.value}</div>
      ))}
      {(!options || options.length === 0) && <span style={{ color: 'var(--text-dim)' }}>-</span>}
    </div>
  )
}

// ─────────── 스타포스 상세 ───────────
function StarforceDetail({ group, icon, onBack }) {
  return (
    <MapleWindow
      title={(
        <span className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="text-white text-lg leading-none" aria-label="뒤로">‹</button>
          {group.item}
        </span>
      )}
      titleRight={(
        <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={PILL_GHOST}>{group.character}</span>
      )}
    >
      {/* 요약 헤더 */}
      <div
        className="rounded-xl p-4 flex items-center gap-5"
        style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
      >
        <ItemIcon url={icon} size={52} />
        <div className="flex-1">
          <div className="font-bold" style={{ color: 'var(--text-strong)' }}>
            {group.item} <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>· {group.character}</span>
          </div>
          <div className="text-lg font-bold mt-1 tabular-nums">
            <span style={{ color: '#c9a227' }}>★{group.startStar}</span>
            <span style={{ color: 'var(--text-dim)' }}> → </span>
            {group.destroyed
              ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span>
              : <span style={{ color: '#c9a227' }}>★{group.endStar}</span>}
          </div>
        </div>
        <div className="flex gap-7 text-center">
          <div>
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>사용 메소 (추정)</div>
            <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: '#c9862a' }}>
              {group.totalCost != null ? formatKoreanMeso(group.totalCost) : '-'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>강화 / 파괴</div>
            <div className="text-base font-bold tabular-nums mt-0.5">
              {group.tries} / <span style={{ color: 'var(--mpl-red-to)' }}>{group.destroyCount}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>★{group.topTarget} 도전</div>
            <div className="text-base font-bold tabular-nums mt-0.5">
              <span style={{ color: 'var(--accent-bright)' }}>{group.topSuccess}성공</span>{' '}
              <span style={{ color: 'var(--mpl-red-to)' }}>{group.topFail}실패</span>
            </div>
          </div>
        </div>
      </div>

      {/* 내역 */}
      <div className="rounded-xl overflow-hidden mt-3" style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}>
        <div
          className="flex items-center justify-between px-4 py-2 text-sm font-bold"
          style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))', color: '#fff', textShadow: '0 1px 1px rgba(44,55,69,.3)' }}
        >
          <span>강화 내역</span>
          <span className="text-[11px] font-semibold" style={{ color: '#cfdae4' }}>비용은 추정값 · {group.records.length}건</span>
        </div>
        <div>
          {group.records.map((r) => {
            const res = sfResult(r)
            const cost = sfCost(r)
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-2 text-sm border-b last:border-b-0"
                style={{
                  borderColor: 'var(--mpl-card-line)',
                  boxShadow: res === 'destroy' ? 'inset 3px 0 0 var(--mpl-red-to)' : undefined,
                }}
              >
                <span className="w-24 shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>{formatTime(r.date_create)}</span>
                <span className="w-32 shrink-0 font-bold tabular-nums">
                  {r.before_starforce_count}성 <span style={{ color: 'var(--text-dim)' }}>→</span>{' '}
                  {res === 'destroy'
                    ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span>
                    : res === 'success'
                      ? <span style={{ color: 'var(--accent-bright)' }}>{r.after_starforce_count}성</span>
                      : `${r.after_starforce_count}성`}
                </span>
                <span className="flex-1 flex items-center gap-1.5">
                  <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={BADGE[res].style}>{BADGE[res].label}</span>
                  {flagApplied(r.destroy_defence) && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)', color: '#3d4a58' }}>🛡 파괴방지</span>
                  )}
                  {flagApplied(r.chance_time) && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: 'linear-gradient(180deg, #ffd76e, #f0a828)', color: '#6b4b00' }}>찬스타임</span>
                  )}
                </span>
                <CostText cost={cost} />
              </div>
            )
          })}
        </div>
      </div>
    </MapleWindow>
  )
}

// ─────────── 잠재 상세 ───────────
function PotentialDetail({ group, icon, onBack }) {
  return (
    <MapleWindow
      title={(
        <span className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="text-white text-lg leading-none" aria-label="뒤로">‹</button>
          {group.item}
        </span>
      )}
      titleRight={(
        <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={PILL_GHOST}>{group.character}</span>
      )}
    >
      {/* 요약 헤더 */}
      <div
        className="rounded-xl p-4 flex items-center gap-5"
        style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
      >
        <ItemIcon url={icon} size={52} />
        <div className="flex-1">
          <div className="font-bold" style={{ color: 'var(--text-strong)' }}>
            {group.item} <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>· {group.part} · Lv.{group.level} · {group.character}</span>
          </div>
          <div className="text-sm font-bold mt-1.5 space-x-4">
            {group.potential && (
              <span>잠재 <GradeText grade={group.potential.from} />{group.potential.from !== group.potential.to && <> <span style={{ color: 'var(--text-dim)' }}>→</span> <GradeText grade={group.potential.to} /></>}</span>
            )}
            {group.additional && (
              <span>에디 <GradeText grade={group.additional.from} />{group.additional.from !== group.additional.to && <> <span style={{ color: 'var(--text-dim)' }}>→</span> <GradeText grade={group.additional.to} /></>}</span>
            )}
          </div>
        </div>
        <div className="flex gap-7 text-center">
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>비용 (추정)</div>
            <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: '#c9862a' }}>
              {group.totalCost != null ? formatKoreanMeso(group.totalCost) : '-'}
            </div>
            {group.totalCost > 0 && (
              <div className="text-[11.5px] tabular-nums mt-0.5" style={{ color: 'var(--text-dim)' }}>
                재설정 {formatKoreanMeso(group.resetCost)} · 감정 {formatKoreanMeso(group.feeCost)}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>큐브 / 메소</div>
            <div className="text-base font-bold tabular-nums mt-0.5">{group.cubeTries} / {group.mesoTries}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>등급 상승</div>
            <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: '#5aa626' }}>{group.gradeUps}회</div>
          </div>
        </div>
      </div>

      {/* 내역 */}
      <div className="rounded-xl overflow-hidden mt-3" style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}>
        <div
          className="flex items-center justify-between px-4 py-2 text-sm font-bold"
          style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))', color: '#fff', textShadow: '0 1px 1px rgba(44,55,69,.3)' }}
        >
          <span>재설정 내역</span>
          <span className="text-[11px] font-semibold" style={{ color: '#cfdae4' }}>비용은 추정값 · {group.records.length}건</span>
        </div>
        <div>
          {group.records.map((r) => {
            const gradeUp = isGradeUp(r)
            const before = r.kind === 'additional' ? r.before_additional_potential_option : r.before_potential_option
            const after = r.kind === 'additional' ? r.after_additional_potential_option : r.after_potential_option
            const ceiling = rowCeiling(r)
            return (
              <div key={r.id} className="px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--mpl-card-line)' }}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>{formatTime(r.date_create)}</span>
                  <KindBadge kind={r.kind} />
                  <MethodBadge row={r} />
                  {gradeUp && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' }}>
                      등급 UP{r.upgrade_guarantee ? ' (천장)' : ''}
                    </span>
                  )}
                  <span className="flex-1" />
                  {r.upgrade_guarantee_count > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={PILL_GHOST}>
                      스택 {r.upgrade_guarantee_count}{ceiling ? ` / ${ceiling}` : ''}
                    </span>
                  )}
                  <CostText cost={potentialCost(r)} />
                </div>
                <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: '1fr 20px 1fr' }}>
                  <OptionBox options={before} />
                  <div className="flex items-center justify-center" style={{ color: 'var(--text-dim)' }}>→</div>
                  <OptionBox options={after} highlight={!gradeUp} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </MapleWindow>
  )
}

// ─────────── 메인 ───────────
export default function Enchant() {
  const { user, isLoading: authLoading } = useAuth()
  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(false)
    return () => setFullscreen(false)
  }, [setFullscreen])

  const [tab, setTab] = useState('starforce')
  const [range, setRange] = useState('7d') // today | 7d | custom
  const [customFrom, setCustomFrom] = useState(daysAgoKST(7))
  const [customTo, setCustomTo] = useState(todayKST())
  const [charFilter, setCharFilter] = useState(null)
  const [detailKey, setDetailKey] = useState(null)
  useBackClose(detailKey != null, () => setDetailKey(null))

  const RANGE_DAYS = { today: 0, '7d': 6, '30d': 29, '6m': 182, '1y': 365 }
  const from = range === 'custom' ? customFrom : daysAgoKST(RANGE_DAYS[range] ?? 6)
  const to = range === 'custom' ? customTo : todayKST()

  const enabled = !!user
  const qOpts = { enabled, staleTime: 60 * 1000, retry: 1 }
  const sfQuery = useQuery({
    queryKey: ['enchant', 'starforce', from, to],
    queryFn: () => api(`/api/enchant/history?type=starforce&from=${from}&to=${to}`),
    ...qOpts,
  })
  const cubeQuery = useQuery({
    queryKey: ['enchant', 'cube', from, to],
    queryFn: () => api(`/api/enchant/history?type=cube&from=${from}&to=${to}`),
    ...qOpts,
  })
  const potQuery = useQuery({
    queryKey: ['enchant', 'potential', from, to],
    queryFn: () => api(`/api/enchant/history?type=potential&from=${from}&to=${to}`),
    ...qOpts,
  })

  const sfItems = useMemo(() => {
    const items = sfQuery.data?.items || []
    return charFilter ? items.filter((i) => i.character_name === charFilter) : items
  }, [sfQuery.data, charFilter])

  const potRows = useMemo(() => {
    const rows = normalizePotential(cubeQuery.data?.items || [], potQuery.data?.items || [])
    return charFilter ? rows.filter((i) => i.character_name === charFilter) : rows
  }, [cubeQuery.data, potQuery.data, charFilter])

  const characterOptions = useMemo(() => {
    const names = new Set()
    for (const i of sfQuery.data?.items || []) names.add(i.character_name)
    for (const i of cubeQuery.data?.items || []) names.add(i.character_name)
    for (const i of potQuery.data?.items || []) names.add(i.character_name)
    return [{ value: null, label: '전체 캐릭터' }, ...[...names].sort().map((n) => ({ value: n, label: n }))]
  }, [sfQuery.data, cubeQuery.data, potQuery.data])

  const characterNames = useMemo(
    () => characterOptions.filter((o) => o.value).map((o) => o.value),
    [characterOptions]
  )
  const iconQuery = useQuery({
    queryKey: ['enchant', 'item-icons', characterNames.join(',')],
    queryFn: () => api(`/api/enchant/item-icons?characters=${encodeURIComponent(characterNames.join(','))}`),
    enabled: enabled && characterNames.length > 0,
    staleTime: 60 * 60 * 1000,
  })
  const itemIcons = iconQuery.data?.items || {}
  const worldIcons = iconQuery.data?.characterWorldIcons || {}

  // 수단(큐브/재설정) 아이콘 — 이미지 관리에 등록된 큐브 이미지 사용
  const methodIconNames = useMemo(() => {
    const names = new Set()
    for (const g of groupPotential(potRows)) for (const m of g.methods) names.add(m.iconName)
    return [...names]
  }, [potRows])
  const methodIconQuery = useQuery({
    queryKey: ['enchant', 'method-icons', methodIconNames.join('|')],
    queryFn: async () => {
      const entries = await Promise.all(methodIconNames.map(async (n) => {
        const d = await api(`/api/images/${encodeURIComponent(n)}`).catch(() => null)
        return [n, d?.url || null]
      }))
      return Object.fromEntries(entries)
    },
    enabled: enabled && methodIconNames.length > 0,
    staleTime: Infinity,
  })
  const methodIcons = methodIconQuery.data || {}

  const sfGroups = useMemo(() => groupStarforce(sfItems), [sfItems])
  const sfSum = useMemo(() => starforceSummary(sfItems), [sfItems])
  const potGroups = useMemo(() => groupPotential(potRows), [potRows])
  const potSum = useMemo(() => potentialSummary(potRows), [potRows])

  if (authLoading) return <PageLoader />

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto pt-16 pb-10">
        <div
          className="rounded-2xl border border-dashed p-14 text-center"
          style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)' }}
        >
          <div className="text-4xl mb-3">🔑</div>
          <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>API 키 로그인이 필요합니다</p>
          <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
            강화 기록은 본인 계정의 넥슨 API 키로 로그인해야 조회할 수 있습니다
          </p>
        </div>
      </div>
    )
  }

  const loading = sfQuery.isLoading || cubeQuery.isLoading || potQuery.isLoading
  const detailGroup = detailKey
    ? (tab === 'starforce' ? sfGroups : potGroups).find((g) => g.key === detailKey)
    : null

  return (
    <div className="pb-10 max-w-6xl mx-auto mpl-page-enter">
      {detailGroup ? (
        tab === 'starforce'
          ? <StarforceDetail group={detailGroup} icon={itemIcons[detailGroup.item]} onBack={() => setDetailKey(null)} />
          : <PotentialDetail group={detailGroup} icon={itemIcons[detailGroup.item]} onBack={() => setDetailKey(null)} />
      ) : (
        <MapleWindow
          title="ENCHANT HISTORY"
          titleRight={(
            <div className="flex items-center gap-2">
              <Select
                value={charFilter}
                onChange={setCharFilter}
                options={characterOptions}
                className="w-36"
              />
              {[
                { key: 'today', label: '오늘' },
                { key: '7d', label: '7일' },
                { key: '30d', label: '30일' },
                { key: '6m', label: '6개월' },
                { key: '1y', label: '1년' },
                { key: 'custom', label: '직접' },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className="rounded-full px-3.5 py-1 text-[11.5px] font-bold"
                  style={range === r.key ? PILL_ACTIVE : PILL_GHOST}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          tabs={[
            { key: 'starforce', label: '⭐ 스타포스' },
            { key: 'potential', label: '✨ 잠재능력' },
          ].map((t) => (
            <MapleWindowTab key={t.key} active={tab === t.key} onClick={() => { setTab(t.key); setDetailKey(null) }}>
              {t.label}
            </MapleWindowTab>
          ))}
          bodyClassName="space-y-3"
        >
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="w-56"><DatePicker value={customFrom} onChange={setCustomFrom} placeholder="시작일" /></div>
              <span style={{ color: 'var(--text-dim)' }}>~</span>
              <div className="w-56"><DatePicker value={customTo} onChange={setCustomTo} placeholder="종료일" /></div>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>최대 31일</span>
            </div>
          )}

          {loading ? (
            <div className="py-24 flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--accent)', borderTopColor: 'transparent' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>넥슨 API에서 이력을 불러오는 중...</span>
            </div>
          ) : tab === 'starforce' ? (
            <>
              <div className="grid grid-cols-6 gap-2.5">
                <SummaryCard label="총 시도" value={`${sfSum.tries}회`} />
                <SummaryCard label="성공" value={`${sfSum.success}회`} color="#5aa626" />
                <SummaryCard label="실패" value={`${sfSum.fail}회`} color="#5c6b7a" />
                <SummaryCard label="파괴" value={`${sfSum.destroy}회`} color="var(--mpl-red-to)" ring={sfSum.destroy > 0 ? '#f0b1a8' : null} />
                <SummaryCard label="파괴방지" value={`${sfSum.defence}회`} color="#c9862a" />
                <SummaryCard label="총 메소 (추정)" value={sfSum.cost > 0 ? formatKoreanMeso(sfSum.cost) : '-'} color="#c9862a" ring="#eec584" />
              </div>
              {sfGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed p-14 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', color: 'var(--text-dim)' }}>
                  기간 내 스타포스 기록이 없습니다
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2.5">
                  {sfGroups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setDetailKey(g.key)}
                      className="rounded-xl px-3 pt-4 pb-3 flex flex-col items-center text-center hover:brightness-[.98] active:scale-[0.98] transition"
                      style={{
                        background: 'var(--mpl-card)',
                        boxShadow: g.destroyCount > 0 ? 'inset 0 0 0 1.5px #f0b1a8' : 'inset 0 0 0 1px var(--mpl-card-line)',
                      }}
                    >
                      <ItemIcon url={itemIcons[g.item]} size={52} />
                      <div className="font-bold text-[15px] leading-tight mt-2" style={{ color: 'var(--text-strong)' }}>{g.item}</div>
                      <div className="text-sm font-bold tabular-nums mt-0.5">
                        <span style={{ color: '#c9a227' }}>★{g.startStar}</span>
                        <span style={{ color: 'var(--text-dim)' }}> → </span>
                        {g.destroyed ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span> : <span style={{ color: '#c9a227' }}>★{g.endStar}</span>}
                      </div>
                      <span
                        className="inline-flex items-center gap-1 rounded-full pl-1.5 pr-2.5 py-0.5 text-[12.5px] font-bold mt-1.5"
                        style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}
                      >
                        {worldIcons[g.character] && (
                          <img src={worldIcons[g.character]} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                        )}
                        {g.character}
                      </span>
                      <div className="text-lg font-bold tabular-nums mt-2.5" style={{ color: '#c9862a' }}>
                        {g.totalCost != null && g.totalCost > 0 ? `${formatKoreanMeso(g.totalCost)} 메소` : '-'}
                      </div>
                      <div
                        className="flex flex-col items-center gap-0.5 mt-auto pt-3 w-full border-t"
                        style={{ borderColor: 'var(--mpl-card-line)' }}
                      >
                        <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          강화/파괴 <b style={{ color: 'var(--text-strong)' }}>{g.tries}</b>번/<b style={{ color: 'var(--mpl-red-to)' }}>{g.destroyCount}</b>번
                        </div>
                        <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ color: '#c9a227' }}>★{g.topTarget}</span> 도전{' '}
                          <b style={{ color: 'var(--accent-bright)' }}>{g.topSuccess}성공</b>{' '}
                          <b style={{ color: 'var(--mpl-red-to)' }}>{g.topFail}실패</b>
                        </div>
                        <div className="text-[12.5px] font-semibold h-4" style={{ color: '#c9862a' }}>
                          {g.failStreak ? `${g.failStreak.star}성에서 ${g.failStreak.count}번 연속 실패` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2.5">
                <SummaryCard label="총 재설정" value={`${potSum.tries}회`} />
                <SummaryCard label="큐브 / 메소" value={`${potSum.cube} / ${potSum.meso}`} />
                <SummaryCard label="등급 상승" value={`${potSum.gradeUps}회`} color="#5aa626" ring={potSum.gradeUps > 0 ? '#b6dc8e' : null} />
                <SummaryCard label="미라클 타임" value={`${potSum.miracle}회`} />
                <SummaryCard label="총 비용 (추정)" value={potSum.cost > 0 ? formatKoreanMeso(potSum.cost) : '-'} color="#c9862a" ring="#eec584" />
              </div>
              {potGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed p-14 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', color: 'var(--text-dim)' }}>
                  기간 내 잠재능력 기록이 없습니다
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2.5">
                  {potGroups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setDetailKey(g.key)}
                      className="rounded-xl px-3 pt-4 pb-3 flex flex-col items-center text-center hover:brightness-[.98] active:scale-[0.98] transition"
                      style={{
                        background: 'var(--mpl-card)',
                        boxShadow: g.gradeUps > 0 ? 'inset 0 0 0 1.5px #b6dc8e' : 'inset 0 0 0 1px var(--mpl-card-line)',
                      }}
                    >
                      <ItemIcon url={itemIcons[g.item]} size={52} />
                      <div className="font-bold text-[15px] leading-tight mt-2" style={{ color: 'var(--text-strong)' }}>{g.item}</div>
                      <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{g.part} · Lv.{g.level}</div>
                      <span
                        className="inline-flex items-center gap-1 rounded-full pl-1.5 pr-2.5 py-0.5 text-[12.5px] font-bold mt-1.5"
                        style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}
                      >
                        {worldIcons[g.character] && (
                          <img src={worldIcons[g.character]} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                        )}
                        {g.character}
                      </span>
                      <CostBreakdown resetCost={g.resetCost} feeCost={g.feeCost} total={g.totalCost}>
                        <div className="text-lg font-bold tabular-nums mt-2.5" style={{ color: '#c9862a' }}>
                          {g.totalCost != null && g.totalCost > 0 ? `${formatKoreanMeso(g.totalCost)} 메소` : '-'}
                        </div>
                      </CostBreakdown>
                      <div
                        className="flex items-end justify-center gap-3.5 flex-wrap mt-auto pt-3 w-full border-t"
                        style={{ borderColor: 'var(--mpl-card-line)' }}
                      >
                        {g.methods.map((m) => (
                          <div key={m.iconName} className="flex flex-col items-center gap-1" title={m.iconName}>
                            {methodIcons[m.iconName]
                              ? <img src={methodIcons[m.iconName]} alt={m.iconName} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                              : <span className="w-9 h-9 rounded flex items-center justify-center text-[11px]" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
                            <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-strong)' }}>{m.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </MapleWindow>
      )}
    </div>
  )
}
