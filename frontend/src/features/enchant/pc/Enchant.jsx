import { useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react'
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
  todayKST, daysAgoKST, formatKoreanMeso, formatDateParts,
  sfResult, sfCost, flagApplied, groupStarforce, starforceSummary,
  normalizePotential, groupPotential, potentialSummary, potentialCost,
  gradeUpPair, rowCeiling, GRADE_COLOR, GRADE_COLOR_SOFT,
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
const SLATE_BAR = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}
const CARD = { background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }

const BADGE = {
  success: { label: '성공', style: { background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))', color: '#fff' } },
  fail: { label: '실패', style: { background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)', color: '#5c6b7a' } },
  destroy: { label: '파괴', style: { background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))', color: '#fff' } },
}

// ─────────── 공용 조각 ───────────

/** 아이템 슬롯 (인게임 장비창 톤) */
function ItemSlot({ url, size = 60 }) {
  return (
    <span
      className="rounded-[10px] flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(180deg, #f4f7fa, #e6ecf2)',
        boxShadow: 'inset 0 0 0 1px var(--mpl-card-line), inset 0 2px 4px rgba(31,44,61,.07)',
      }}
    >
      {url
        ? <img src={url} alt="" draggable={false} loading="lazy" decoding="async"
            style={{ maxWidth: size * 0.68, maxHeight: size * 0.68, objectFit: 'contain', imageRendering: 'pixelated', filter: 'drop-shadow(0 0 1px rgba(1,0,0,.5))' }} />
        : <span style={{ color: 'var(--text-dim)', fontSize: size * 0.32 }}>?</span>}
    </span>
  )
}

function SummaryCard({ label, value, color, ring }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={ring ? { background: 'var(--mpl-card)', boxShadow: `inset 0 0 0 2px ${ring}` } : CARD}>
      <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: color || 'var(--text-strong)' }}>{value}</div>
    </div>
  )
}

function GradeText({ grade, soft = false }) {
  if (!grade) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  return <span style={{ color: (soft ? GRADE_COLOR_SOFT : GRADE_COLOR)[grade] || 'var(--text-strong)' }}>{grade}</span>
}

/** 상세 요약 통계 칸 (구분선으로 나눈 큰 숫자) */
function StatCell({ label, value, sub, color, first }) {
  return (
    <div
      className={`flex-1 px-4 py-3 ${first ? 'text-left' : 'text-center'}`}
      style={first ? undefined : { borderLeft: '1px solid var(--mpl-card-line)' }}
    >
      <div className="text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[21px] font-bold tabular-nums mt-0.5" style={{ color: color || 'var(--text-strong)', letterSpacing: '-.3px' }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

/** 수단 아이콘 이름 (큐브명 또는 재설정 종류) */
function methodIconName(r) {
  return r.method === 'cube' ? r.cube_type : (r.kind === 'additional' ? '에디셔널 잠재능력 재설정' : '잠재능력 재설정')
}

/** 카드 하단 수단 스트립 — 상위 4개 + (+N) 클릭 팝오버 */
function MethodStrip({ methods, methodIcons }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const top = methods.slice(0, 4)
  const rest = methods.slice(4)

  return (
    <div className="mt-2.5 pt-3 w-full flex items-end justify-center gap-3.5" style={{ borderTop: '1px dashed #d9e2ea' }}>
      {top.map((m) => (
        <div key={m.iconName} className="flex flex-col items-center gap-1" title={m.iconName}>
          {methodIcons[m.iconName]
            ? <img src={methodIcons[m.iconName]} alt={m.iconName} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
            : <span className="w-9 h-9 rounded flex items-center justify-center text-[11px]" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
          <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-strong)' }}>{m.count.toLocaleString()}</span>
        </div>
      ))}
      {rest.length > 0 && (
        <div ref={ref} className="relative flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
            className="w-11 h-11 -my-1 rounded-full flex items-center justify-center text-[15px] font-bold transition"
            style={open
              ? { background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))', color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)' }
              : { background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}
          >
            +{rest.length}
          </button>
          <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-dim)' }}>
            {rest.reduce((s, m) => s + m.count, 0).toLocaleString()}
          </span>

          {open && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 w-[272px] rounded-[10px] overflow-hidden text-left"
              style={{ background: 'var(--mpl-win-body)', border: '1px solid rgba(31,44,61,.4)', boxShadow: '0 12px 32px rgba(31,44,61,.32)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))' }}>
                <span className="text-[11.5px] font-bold" style={{ color: 'var(--mpl-title-yellow)', letterSpacing: '1.5px', textShadow: '1px 1px 0 rgba(31,44,61,.6)' }}>ALL CUBES</span>
                <button type="button" onClick={() => setOpen(false)} className="text-[15px] leading-none" style={{ color: '#9fb0c1' }} aria-label="닫기">×</button>
              </div>
              <div className="p-[7px]">
                <div className="rounded-[7px] p-[5px]" style={{ background: 'var(--mpl-panel)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}>
                  {methods.map((m, i) => (
                    <div
                      key={m.iconName}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md"
                      style={i % 2 === 0 ? { background: 'var(--mpl-card)' } : undefined}
                    >
                      {methodIcons[m.iconName]
                        ? <img src={methodIcons[m.iconName]} alt="" className="w-9 h-9 object-contain shrink-0" style={{ imageRendering: 'pixelated' }} draggable={false} />
                        : <span className="w-9 h-9 shrink-0" />}
                      <span className="flex-1 text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-muted)' }}>{m.iconName}</span>
                      <b className="text-[13px] tabular-nums" style={{ color: 'var(--text-strong)' }}>{m.count.toLocaleString()}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 아이템 카드 (명패형) */
function ItemCard({ onClick, icon, worldIcon, character, name, sub, cost, footer, ring }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
      className="relative z-0 hover:z-30 rounded-xl flex flex-col cursor-pointer hover:brightness-[.99] active:scale-[0.995] transition"
      style={{ background: 'var(--mpl-card)', boxShadow: `0 2px 8px rgba(31,44,61,.10), inset 0 0 0 ${ring ? '1.5px ' + ring : '1px var(--mpl-card-line)'}` }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-[7px] rounded-t-xl" style={SLATE_BAR}>
        {worldIcon && <img src={worldIcon} alt="" className="w-4 h-4 object-contain shrink-0" style={{ imageRendering: 'pixelated' }} draggable={false} />}
        <span className="text-[12.5px] font-bold truncate">{character}</span>
      </div>
      <div className="px-3 pt-3.5 pb-3 flex flex-col items-center text-center flex-1">
        <ItemSlot url={icon} />
        <div className="text-[15px] font-bold leading-tight mt-2" style={{ color: 'var(--text-strong)' }}>{name}</div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{sub}</div>
        <div className="text-[19px] font-bold tabular-nums mt-2.5" style={{ color: '#c9862a', letterSpacing: '-.4px' }}>{cost}</div>
        {footer}
      </div>
    </div>
  )
}

/** 상세 헤더 (뒤로가기 + 아이템명 / 우측 캐릭터) */
function detailTitle(group, onBack) {
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={onBack} className="text-white text-lg leading-none" aria-label="뒤로">‹</button>
      {group.item}
    </span>
  )
}
function detailNick(group, worldIcon) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1 text-xs font-bold"
      style={{ background: 'rgba(255,255,255,.14)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)', color: '#fff' }}>
      {worldIcon && <img src={worldIcon} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />}
      {group.character}
    </span>
  )
}

// ─────────── 잠재 상세 ───────────
function PotentialDetail({ group, icon, worldIcon, methodIcons, onBack }) {
  return (
    <MapleWindow title={detailTitle(group, onBack)} titleRight={detailNick(group, worldIcon)} bodyClassName="space-y-3">
      {/* 요약 명패 */}
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <ItemSlot url={icon} size={64} />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold" style={{ color: 'var(--text-strong)' }}>{group.item}</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{group.part} · Lv.{group.level}</div>
            <div className="flex gap-3.5 mt-1.5 text-[13px] font-bold">
              {group.potential && (
                <span>잠재 <GradeText grade={group.potential.from} />{group.potential.from !== group.potential.to && <><span style={{ color: 'var(--text-dim)', fontWeight: 700 }}> → </span><GradeText grade={group.potential.to} /></>}</span>
              )}
              {group.additional && (
                <span>에디 <GradeText grade={group.additional.from} />{group.additional.from !== group.additional.to && <><span style={{ color: 'var(--text-dim)', fontWeight: 700 }}> → </span><GradeText grade={group.additional.to} /></>}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex" style={{ borderTop: '1px solid var(--mpl-card-line)' }}>
          <StatCell
            first
            label="사용 메소 (추정)"
            value={group.totalCost != null ? formatKoreanMeso(group.totalCost) : '-'}
            sub={group.totalCost > 0 ? `재설정 ${formatKoreanMeso(group.resetCost)} · 감정 ${formatKoreanMeso(group.feeCost)}` : null}
            color="#c9862a"
          />
          <StatCell label="큐브 / 메소" value={`${group.cubeTries.toLocaleString()} / ${group.mesoTries.toLocaleString()}`} sub={`총 ${group.tries.toLocaleString()}회`} />
          <StatCell label="등급 상승" value={`${group.gradeUps}회`} color={group.gradeUps > 0 ? '#4e9e20' : undefined} />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="flex items-center px-3.5 py-2 text-xs font-bold" style={SLATE_BAR}>
          <span className="w-[92px] shrink-0">일시</span>
          <span className="flex-1 min-w-0">수단</span>
          <span className="w-[258px] shrink-0 pr-2.5">변경 전</span>
          <span className="w-[258px] shrink-0">변경 후</span>
          <span className="w-[90px] text-right shrink-0">비용</span>
        </div>
        {group.records.map((r, idx) => {
          const { date, time } = formatDateParts(r.date_create)
          const up = gradeUpPair(r)
          const before = r.kind === 'additional' ? r.before_additional_potential_option : r.before_potential_option
          const after = r.kind === 'additional' ? r.after_additional_potential_option : r.after_potential_option
          const ceiling = rowCeiling(r)
          const mIcon = methodIcons[methodIconName(r)]
          const cost = potentialCost(r)
          return (
            <div
              key={r.id}
              className="flex items-center px-3.5 py-2.5 border-b last:border-b-0 text-[12.5px]"
              style={{ borderColor: 'var(--mpl-card-line)', background: idx % 2 === 1 ? 'var(--mpl-row)' : undefined }}
            >
              <span className="w-[92px] shrink-0 leading-tight">
                <span className="block text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{date}</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--text-dim)' }}>{time}</span>
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-1 pr-3">
                <span className="flex items-center gap-1.5 min-w-0">
                  {mIcon
                    ? <img src={mIcon} alt="" className="w-[26px] h-[26px] object-contain shrink-0" style={{ imageRendering: 'pixelated' }} draggable={false} />
                    : <span className="w-[26px] h-[26px] shrink-0 flex items-center justify-center text-xs">💰</span>}
                  <span className="text-[11.5px] font-bold truncate" style={{ color: 'var(--text-muted)' }}>{r.methodName}</span>
                </span>
                {up ? (
                  <span
                    className="inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{ background: 'linear-gradient(180deg, #fdf6e3, #f7e9c8)', boxShadow: 'inset 0 0 0 1px #e6d3a4' }}
                  >
                    <GradeText grade={up.from} /><span style={{ color: '#b9a473', fontSize: 9 }}>▶</span><GradeText grade={up.to} />
                  </span>
                ) : r.upgrade_guarantee_count > 0 ? (
                  <span className="self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={PILL_GHOST}>
                    스택 {r.upgrade_guarantee_count}{ceiling ? ` / ${ceiling}` : ''}
                  </span>
                ) : null}
              </span>
              <span className="w-[258px] shrink-0 pr-2.5 leading-[1.45]">
                {(before || []).map((o, i) => (
                  <span key={i} className="block" style={{ color: GRADE_COLOR_SOFT[o.grade] || '#a6b4c0' }}>{o.value}</span>
                ))}
                {(!before || before.length === 0) && <span style={{ color: 'var(--text-dim)' }}>-</span>}
              </span>
              <span className="w-[258px] shrink-0 leading-[1.45] font-bold">
                {(after || []).map((o, i) => (
                  <span key={i} className="block" style={{ color: GRADE_COLOR[o.grade] || 'var(--text-muted)' }}>{o.value}</span>
                ))}
                {(!after || after.length === 0) && <span style={{ color: 'var(--text-dim)' }}>-</span>}
              </span>
              <span className="w-[90px] text-right shrink-0 font-bold tabular-nums" style={{ color: '#c9862a' }}>
                {cost != null ? formatKoreanMeso(cost) : '-'}
              </span>
            </div>
          )
        })}
      </div>
    </MapleWindow>
  )
}

// ─────────── 스타포스 상세 ───────────
function StarforceDetail({ group, icon, worldIcon, onBack }) {
  return (
    <MapleWindow title={detailTitle(group, onBack)} titleRight={detailNick(group, worldIcon)} bodyClassName="space-y-3">
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <ItemSlot url={icon} size={64} />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold" style={{ color: 'var(--text-strong)' }}>{group.item}</div>
            <div className="text-xl font-bold mt-1 tabular-nums">
              <span style={{ color: '#c9a227' }}>★{group.startStar}</span>
              <span style={{ color: 'var(--text-dim)' }}> → </span>
              {group.destroyed ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span> : <span style={{ color: '#c9a227' }}>★{group.endStar}</span>}
            </div>
          </div>
        </div>
        <div className="flex" style={{ borderTop: '1px solid var(--mpl-card-line)' }}>
          <StatCell first label="사용 메소 (추정)" value={group.totalCost != null && group.totalCost > 0 ? formatKoreanMeso(group.totalCost) : '-'} color="#c9862a" />
          <StatCell label="강화 / 파괴" value={`${group.tries} / ${group.destroyCount}`} sub={`파괴방지 ${group.defenceCount}회`} />
          <StatCell
            label={`★${group.topTarget} 도전`}
            value={<><span style={{ color: 'var(--accent-bright)' }}>{group.topSuccess}</span> / <span style={{ color: 'var(--mpl-red-to)' }}>{group.topFail}</span></>}
            sub="성공 / 실패"
          />
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="flex items-center px-3.5 py-2 text-xs font-bold" style={SLATE_BAR}>
          <span className="w-[92px] shrink-0">일시</span>
          <span className="w-[150px] shrink-0">단계</span>
          <span className="flex-1">결과</span>
          <span className="w-[120px] text-right shrink-0">비용</span>
        </div>
        {group.records.map((r, idx) => {
          const { date, time } = formatDateParts(r.date_create)
          const res = sfResult(r)
          const cost = sfCost(r)
          return (
            <div
              key={r.id}
              className="flex items-center px-3.5 py-2.5 border-b last:border-b-0 text-[12.5px]"
              style={{
                borderColor: 'var(--mpl-card-line)',
                background: idx % 2 === 1 ? 'var(--mpl-row)' : undefined,
                boxShadow: res === 'destroy' ? 'inset 3px 0 0 var(--mpl-red-to)' : undefined,
              }}
            >
              <span className="w-[92px] shrink-0 leading-tight">
                <span className="block text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{date}</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--text-dim)' }}>{time}</span>
              </span>
              <span className="w-[150px] shrink-0 font-bold tabular-nums text-[13px]">
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
              <span className="w-[120px] text-right shrink-0 tabular-nums whitespace-nowrap">
                {cost == null ? <span style={{ color: 'var(--text-dim)' }}>-</span> : (
                  <>
                    {cost.discounted && <span className="text-[11px] line-through mr-1.5" style={{ color: 'var(--text-dim)' }}>{formatKoreanMeso(cost.base)}</span>}
                    <span className="font-bold" style={{ color: '#c9862a' }}>{formatKoreanMeso(cost.final)}</span>
                  </>
                )}
              </span>
            </div>
          )
        })}
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
  const [range, setRange] = useState('7d')
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
  const sfQuery = useQuery({ queryKey: ['enchant', 'starforce', from, to], queryFn: () => api(`/api/enchant/history?type=starforce&from=${from}&to=${to}`), ...qOpts })
  const cubeQuery = useQuery({ queryKey: ['enchant', 'cube', from, to], queryFn: () => api(`/api/enchant/history?type=cube&from=${from}&to=${to}`), ...qOpts })
  const potQuery = useQuery({ queryKey: ['enchant', 'potential', from, to], queryFn: () => api(`/api/enchant/history?type=potential&from=${from}&to=${to}`), ...qOpts })

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

  const characterNames = useMemo(() => characterOptions.filter((o) => o.value).map((o) => o.value), [characterOptions])
  const iconQuery = useQuery({
    queryKey: ['enchant', 'item-icons', characterNames.join(',')],
    queryFn: () => api(`/api/enchant/item-icons?characters=${encodeURIComponent(characterNames.join(','))}`),
    enabled: enabled && characterNames.length > 0,
    staleTime: 60 * 60 * 1000,
  })
  const itemIcons = iconQuery.data?.items || {}
  const worldIcons = iconQuery.data?.characterWorldIcons || {}

  const sfGroups = useMemo(() => groupStarforce(sfItems), [sfItems])
  const sfSum = useMemo(() => starforceSummary(sfItems), [sfItems])
  const potGroups = useMemo(() => groupPotential(potRows), [potRows])
  const potSum = useMemo(() => potentialSummary(potRows), [potRows])

  const methodIconNames = useMemo(() => {
    const names = new Set()
    for (const g of potGroups) for (const m of g.methods) names.add(m.iconName)
    return [...names]
  }, [potGroups])
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

  if (authLoading) return <PageLoader />

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto pt-16 pb-10">
        <div className="rounded-2xl border border-dashed p-14 text-center" style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)' }}>
          <div className="text-4xl mb-3">🔑</div>
          <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>API 키 로그인이 필요합니다</p>
          <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>강화 기록은 본인 계정의 넥슨 API 키로 로그인해야 조회할 수 있습니다</p>
        </div>
      </div>
    )
  }

  const loading = sfQuery.isLoading || cubeQuery.isLoading || potQuery.isLoading
  const detailGroup = detailKey ? (tab === 'starforce' ? sfGroups : potGroups).find((g) => g.key === detailKey) : null

  return (
    <div className="pb-10 max-w-6xl mx-auto mpl-page-enter">
      {detailGroup ? (
        tab === 'starforce'
          ? <StarforceDetail group={detailGroup} icon={itemIcons[detailGroup.item]} worldIcon={worldIcons[detailGroup.character]} onBack={() => setDetailKey(null)} />
          : <PotentialDetail group={detailGroup} icon={itemIcons[detailGroup.item]} worldIcon={worldIcons[detailGroup.character]} methodIcons={methodIcons} onBack={() => setDetailKey(null)} />
      ) : (
        <MapleWindow
          title="ENCHANT HISTORY"
          titleRight={(
            <div className="flex items-center gap-2">
              <Select value={charFilter} onChange={setCharFilter} options={characterOptions} className="w-36" />
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
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>최대 1년</span>
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
                <div className="grid grid-cols-4 gap-3">
                  {sfGroups.map((g) => (
                    <ItemCard
                      key={g.key}
                      onClick={() => setDetailKey(g.key)}
                      icon={itemIcons[g.item]}
                      worldIcon={worldIcons[g.character]}
                      character={g.character}
                      name={g.item}
                      sub={<>
                        <span style={{ color: '#c9a227', fontWeight: 800 }}>★{g.startStar}</span>
                        <span> → </span>
                        {g.destroyed
                          ? <span style={{ color: 'var(--mpl-red-to)', fontWeight: 800 }}>파괴</span>
                          : <span style={{ color: '#c9a227', fontWeight: 800 }}>★{g.endStar}</span>}
                      </>}
                      cost={g.totalCost != null && g.totalCost > 0 ? `${formatKoreanMeso(g.totalCost)} 메소` : '-'}
                      ring={g.destroyCount > 0 ? '#f0b1a8' : null}
                      footer={(
                        <div className="mt-2.5 pt-3 w-full flex flex-col items-center gap-0.5" style={{ borderTop: '1px dashed #d9e2ea' }}>
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
                      )}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2.5">
                <SummaryCard label="총 재설정" value={`${potSum.tries}회`} />
                <SummaryCard label="큐브 / 메소" value={`${potSum.cube} / ${potSum.meso}`} />
                <SummaryCard label="등급 상승" value={`${potSum.gradeUps}회`} color="#5aa626" />
                <SummaryCard label="미라클 타임" value={`${potSum.miracle}회`} />
                <SummaryCard label="총 비용 (추정)" value={potSum.cost > 0 ? formatKoreanMeso(potSum.cost) : '-'} color="#c9862a" ring="#eec584" />
              </div>
              {potGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed p-14 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', color: 'var(--text-dim)' }}>
                  기간 내 잠재능력 기록이 없습니다
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {potGroups.map((g) => (
                    <ItemCard
                      key={g.key}
                      onClick={() => setDetailKey(g.key)}
                      icon={itemIcons[g.item]}
                      worldIcon={worldIcons[g.character]}
                      character={g.character}
                      name={g.item}
                      sub={`${g.part} · Lv.${g.level}`}
                      cost={g.totalCost != null && g.totalCost > 0 ? `${formatKoreanMeso(g.totalCost)} 메소` : '-'}
                      footer={<MethodStrip methods={g.methods} methodIcons={methodIcons} />}
                    />
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
