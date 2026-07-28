import { useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../hooks/useAuth'
import { useLayout } from '../../../components/pc/Layout'
import { useBackClose } from '../../../hooks/useBackClose'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
import PageLoader from '../../../components/common/PageLoader'
import Select from '../../../components/common/Select'
import { setDynamicItemLevels } from '../costs'
import {
  formatKoreanMeso, formatDateParts,
  sfResult, sfCost, flagApplied, isDrop, groupStarforce, starforceSummary,
  normalizePotential, groupPotential, potentialCost,
  gradeUpPair, rowCeiling, starRangeStats, potentialStats, sortGroups, SORT_OPTIONS,
  GRADE_COLOR, GRADE_COLOR_SOFT,
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
const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }

const BADGE = {
  success: { label: '성공', style: { background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))', color: '#fff' } },
  fail: { label: '실패', style: { background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)', color: '#5c6b7a' } },
  drop: { label: '하락', style: { background: 'linear-gradient(180deg, #f0b661, #dd9231)', color: '#fff' } },
  destroy: { label: '파괴', style: { background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))', color: '#fff' } },
}

// ─────────── 공용 조각 ───────────

/**
 * 게임 아이콘 — 원본보다 키울 땐 픽셀 유지(선명), 줄일 땐 부드럽게(뭉개짐 방지)
 * 저해상도 도트(예: 11×10)를 정수 배율로 키우면 깨지지 않는다.
 */
function GameIcon({ url, size, alt = '', className = '' }) {
  const [natural, setNatural] = useState(null)
  if (!url) return null
  const upscaling = natural != null && natural < size
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        imageRendering: upscaling ? 'pixelated' : 'auto',
      }}
    />
  )
}

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
  // 1의 자리까지 표기하면 값이 길어진다 — 길이에 따라 폰트를 줄여 한 줄을 유지
  const len = String(value).length
  const size = len > 20 ? 15 : len > 16 ? 17 : len > 13 ? 19 : 21
  return (
    <div className="rounded-xl px-3.5 py-3" style={ring ? { background: 'var(--mpl-card)', boxShadow: `inset 0 0 0 2px ${ring}` } : CARD}>
      <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div
        className="font-bold tabular-nums mt-0.5 whitespace-nowrap"
        style={{ color: color || 'var(--text-strong)', fontSize: size, letterSpacing: '-.3px' }}
      >
        {value}
      </div>
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
      <div className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[21px] font-bold tabular-nums mt-0.5" style={{ color: color || 'var(--text-strong)', letterSpacing: '-.3px' }}>{value}</div>
      {sub && <div className="text-[13px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

/** 수단 아이콘 이름 (큐브명 또는 재설정 종류) */
function methodIconName(r) {
  return r.method === 'cube' ? r.cube_type : (r.kind === 'additional' ? '에디셔널 잠재능력 재설정' : '잠재능력 재설정')
}

/** 스타포스 카드 하단 — 성공 / 실패 / 파괴 횟수 */
function ResultStrip({ success, fail, destroy }) {
  const cells = [
    { label: '성공', value: success, color: 'var(--mpl-lime-to)' },
    { label: '실패', value: fail, color: 'var(--text-muted)' },
    { label: '파괴', value: destroy, color: destroy > 0 ? 'var(--mpl-red-to)' : 'var(--text-dim)' },
  ]
  return (
    <div className="mt-2.5 pt-3 w-full flex items-center" style={{ borderTop: '1px dashed #d9e2ea' }}>
      {cells.map((c, i) => (
        <div
          key={c.label}
          className="flex-1 flex flex-col items-center gap-0.5"
          style={i > 0 ? { borderLeft: '1px solid var(--mpl-card-line)' } : undefined}
        >
          <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
          <span className="text-[17px] font-bold tabular-nums leading-none" style={{ color: c.color }}>
            {c.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 카드 하단 수단 스트립 — 상위 4개 + (+N) 클릭 팝오버 (body 포털) */
function MethodStrip({ methods, methodIcons }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })
  const btnRef = useRef(null)
  const popRef = useRef(null)

  const POP_W = 272
  const place = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(r.left + r.width / 2 - POP_W / 2, window.innerWidth - POP_W - 8)),
      bottom: window.innerHeight - r.top + 10,
    })
  }

  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScroll = () => place()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const top = methods.slice(0, 4)
  const rest = methods.slice(4)

  return (
    <div className="mt-2.5 pt-3 w-full flex items-end justify-center gap-3.5" style={{ borderTop: '1px dashed #d9e2ea' }}>
      {top.map((m) => (
        <div key={m.iconName} className="flex flex-col items-center gap-1" title={m.iconName}>
          {methodIcons[m.iconName]
            ? <img src={methodIcons[m.iconName]} alt={m.iconName} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
            : <span className="w-9 h-9 rounded flex items-center justify-center text-[13px]" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
          <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-strong)' }}>{m.count.toLocaleString()}</span>
        </div>
      ))}
      {rest.length > 0 && (
        <div className="flex flex-col items-center gap-1 self-center">
          <button
            ref={btnRef}
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
            className="w-11 h-11 -my-1 rounded-full flex items-center justify-center text-[15px] font-bold transition"
            style={open
              ? { background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))', color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)' }
              : { background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}
          >
            +{rest.length}
          </button>
          {open && createPortal(
            <div
              ref={popRef}
              className="fixed z-[100] rounded-[10px] overflow-hidden text-left"
              style={{
                left: pos.left,
                bottom: pos.bottom,
                width: POP_W,
                background: 'var(--mpl-win-body)',
                border: '1px solid rgba(31,44,61,.4)',
                boxShadow: '0 12px 32px rgba(31,44,61,.32)',
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))' }}>
                <span className="text-[13px] font-bold" style={{ color: 'var(--mpl-title-yellow)', letterSpacing: '1.5px', textShadow: '1px 1px 0 rgba(31,44,61,.6)' }}>ALL CUBES</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setOpen(false) }}
                  className="text-[15px] leading-none"
                  style={{ color: '#9fb0c1' }}
                  aria-label="닫기"
                >×</button>
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
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  )
}

/** 비용 브레이크다운 호버 툴팁 */
function CostTooltip({ resetCost, feeCost, total, children }) {
  const [show, setShow] = useState(false)
  if (!total || total <= 0) return children
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-56 rounded-xl p-3 text-left"
          style={{ background: 'var(--popup-bg)', boxShadow: 'var(--popup-shadow), inset 0 0 0 1px var(--popup-border)' }}
        >
          <span className="flex items-center justify-between text-[13px] py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>잠재 재설정</span>
            <b className="tabular-nums" style={{ color: 'var(--text-strong)' }}>{formatKoreanMeso(resetCost)}</b>
          </span>
          <span className="flex items-center justify-between text-[13px] py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>큐브 감정</span>
            <b className="tabular-nums" style={{ color: 'var(--text-strong)' }}>{formatKoreanMeso(feeCost)}</b>
          </span>
          <span className="flex items-center justify-between text-[13px] pt-1.5 mt-1 border-t" style={{ borderColor: 'var(--popup-border)' }}>
            <span className="font-bold" style={{ color: 'var(--text-muted)' }}>합계</span>
            <b className="tabular-nums text-[14px]" style={{ color: 'var(--accent-bright)' }}>{formatKoreanMeso(total)}</b>
          </span>
        </span>
      )}
    </span>
  )
}

/** 스타포스 비용 툴팁 — 정가와 달라진 사유 표시 (스크롤 영역에 잘리지 않도록 body 포털) */
function CostReasonTooltip({ cost, children }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const reasons = cost?.reasons || []
  if (reasons.length === 0) return children

  const W = 300
  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const flipDown = r.top < 170
    setPos({
      left: Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)),
      top: flipDown ? r.bottom + 8 : null,
      bottom: flipDown ? null : window.innerHeight - r.top + 8,
    })
  }

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <div
          className="fixed z-[120] rounded-xl p-3 text-left pointer-events-none"
          style={{
            width: W,
            left: pos.left,
            ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
            background: 'var(--popup-bg)',
            boxShadow: 'var(--popup-shadow), inset 0 0 0 1px var(--popup-border)',
          }}
        >
          <div className="flex items-center justify-between text-[13px] py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>기본 비용</span>
            <b className="tabular-nums" style={{ color: 'var(--text-strong)' }}>{formatKoreanMeso(cost.base)}</b>
          </div>
          {reasons.map((r) => (
            <div key={r.label} className="flex items-start justify-between text-[13px] py-0.5 gap-3">
              <span className="leading-snug" style={{ color: 'var(--text-muted)', wordBreak: 'keep-all' }}>{r.label}</span>
              <b className="tabular-nums shrink-0 whitespace-nowrap" style={{ color: 'var(--accent-bright)' }}>{r.effect}</b>
            </div>
          ))}
          <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1 border-t" style={{ borderColor: 'var(--popup-border)' }}>
            <span className="font-bold" style={{ color: 'var(--text-muted)' }}>실제 비용</span>
            <b className="tabular-nums text-[14px]" style={{ color: 'var(--accent-bright)' }}>{formatKoreanMeso(cost.final)}</b>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

/** 카드 금액 — 자릿수가 많아지면 폰트를 줄여 한 줄 유지 */
function CostText({ cost }) {
  const len = String(cost).length
  const size = len > 18 ? 15 : len > 15 ? 17 : 19
  return (
    <div
      className="font-bold tabular-nums mt-2.5 whitespace-nowrap"
      style={{ color: 'var(--accent-bright)', fontSize: size, letterSpacing: '-.4px' }}
    >
      {cost}
    </div>
  )
}

/** 아이템 카드 (명패형) */
function ItemCard({ onClick, icon, worldIcon, character, name, sub, cost, costTip, footer, ring }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
      className="rounded-xl flex flex-col cursor-pointer hover:brightness-[.99] transition"
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
        {costTip ? (
          <CostTooltip {...costTip}><CostText cost={cost} /></CostTooltip>
        ) : (
          <CostText cost={cost} />
        )}
        {footer}
      </div>
    </div>
  )
}

/**
 * 내역 가상 스크롤 — 화면에 보이는 행만 렌더 (fromis_9 일정 페이지와 동일한 방식)
 * 수천 건이어도 DOM에는 수십 개만 존재해 진입·스크롤이 모두 가볍다.
 */
function useRowVirtualizer(count, estimateSize) {
  const [scrollEl, setScrollEl] = useState(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollEl,
    estimateSize: () => estimateSize,
    overscan: 8,
  })
  // OverlayScrollbars가 만든 뷰포트 요소를 스크롤 소스로 사용
  const onScrollbarsInit = (instance) => setScrollEl(instance.elements().viewport)
  return { onScrollbarsInit, virtualizer }
}

/** 잠재 탭 상단 통계 — 누적 비용 · 수단별 사용량 · 등급별 재설정 · 등급업 확률 */
function PotentialStatsPanel({ stat, methodIcons, compact = false }) {
  const grades = ['레어', '에픽', '유니크', '레전드리']
  const box = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }
  const head = {
    background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
    color: '#fff',
    textShadow: '0 1px 1px rgba(44,55,69,.3)',
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2.5">
        <div className="rounded-xl px-4 py-3" style={box}>
          <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{compact ? '재설정 비용' : '누적 재설정 비용'}</div>
          <div className="text-[22px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--accent-bright)' }}>{formatKoreanMeso(stat.resetCost)}</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={box}>
          <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{compact ? '감정 비용' : '누적 감정 비용'}</div>
          <div className="text-[22px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--accent-bright)' }}>{formatKoreanMeso(stat.feeCost)}</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={box}>
          <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>총 재설정</div>
          <div className="text-[22px] font-bold tabular-nums mt-0.5">{stat.total.toLocaleString()}회</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={box}>
          <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>미라클 타임</div>
          <div className="text-[22px] font-bold tabular-nums mt-0.5">{stat.miracle.toLocaleString()}회</div>
        </div>
      </div>

      <div className="grid gap-3 items-start" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
        <div className="rounded-xl overflow-hidden" style={box}>
          <div className="px-4 py-2 text-[13px] font-bold" style={head}>재설정 횟수 / 큐브 개수</div>
          <div className="p-3 grid grid-cols-6 gap-x-2 gap-y-3">
            {stat.methods.map((m) => (
              <div key={m.iconName} className="flex flex-col items-center gap-1" title={m.iconName}>
                {methodIcons[m.iconName]
                  ? <img src={methodIcons[m.iconName]} alt="" className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                  : <span className="w-9 h-9 rounded flex items-center justify-center text-[13px]" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
                <span className="text-[12.5px] font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>{m.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={box}>
          <div className="flex items-center px-4 py-2 text-[13px] font-bold" style={head}>
            <span className="flex-1">등급별 재설정</span>
            <span className="w-[92px] text-right">잠재</span>
            <span className="w-[92px] text-right">에디셔널</span>
          </div>
          {grades.map((g, i) => (
            <div
              key={g}
              className="flex items-center px-4 py-2 text-[13.5px] border-b last:border-b-0"
              style={{ borderColor: 'var(--mpl-card-line)', background: i % 2 === 1 ? 'var(--mpl-row)' : undefined }}
            >
              <span className="flex-1 font-bold" style={{ color: GRADE_COLOR[g] }}>{g}</span>
              <span className="w-[92px] text-right tabular-nums font-bold">{(stat.resetByGrade.potential[g] || 0).toLocaleString()}</span>
              <span className="w-[92px] text-right tabular-nums font-bold">{(stat.resetByGrade.additional[g] || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'potential', label: '잠재능력 등급업' },
          { key: 'additional', label: '에디셔널 잠재능력 등급업' },
        ].map((sec) => (
          <div key={sec.key} className="rounded-xl overflow-hidden" style={box}>
            <div className="flex items-center px-4 py-2 text-[13px] font-bold" style={head}>
              <span className="flex-1">{sec.label}</span>
              <span className="w-[92px] text-right">성공 / 시도</span>
              <span className="w-[72px] text-right">확률</span>
            </div>
            {stat.upgradeRates[sec.key].map((r, i) => (
              <div
                key={r.from}
                className="flex items-center px-4 py-2 text-[13.5px] border-b last:border-b-0"
                style={{ borderColor: 'var(--mpl-card-line)', background: i % 2 === 1 ? 'var(--mpl-row)' : undefined }}
              >
                <span className="flex-1 font-bold">
                  <span style={{ color: GRADE_COLOR[r.from] }}>{r.from}</span>
                  <span style={{ color: 'var(--text-dim)' }}> → </span>
                  <span style={{ color: GRADE_COLOR[r.to] }}>{r.to}</span>
                </span>
                <span className="w-[92px] text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {r.success.toLocaleString()} / {r.tries.toLocaleString()}
                </span>
                <span className="w-[72px] text-right tabular-nums font-bold" style={{ color: r.tries > 0 ? 'var(--accent-bright)' : 'var(--text-dim)' }}>
                  {r.tries > 0 ? `${r.rate.toFixed(2)}%` : '-'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 상세 헤더 좌측: 목록으로 + 섹션 타이틀 */
function detailTitle(label, onBack) {
  return (
    <span className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-full pl-2 pr-3 py-1 text-xs font-bold"
        style={{ background: 'rgba(255,255,255,.14)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)', color: '#fff' }}
      >
        ‹ 목록
      </button>
      {label}
    </span>
  )
}

/** 상세 헤더 우측: 조회 기간 + 아이템 이동 */
function detailRight({ periodLabel, index, total, onPrev, onNext }) {
  const chip = {
    background: 'rgba(255,255,255,.14)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)',
    color: '#fff',
  }
  return (
    <span className="flex items-center gap-2">
      <span className="rounded-full px-3 py-1 text-[13px] font-bold" style={chip}>{periodLabel}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={index <= 0}
          className="w-6 h-6 rounded-full text-sm leading-none disabled:opacity-35"
          style={chip}
          aria-label="이전 아이템"
        >‹</button>
        <span className="text-[13px] font-bold tabular-nums px-1" style={{ color: '#cfdae4' }}>{index + 1} / {total}</span>
        <button
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
          className="w-6 h-6 rounded-full text-sm leading-none disabled:opacity-35"
          style={chip}
          aria-label="다음 아이템"
        >›</button>
      </span>
    </span>
  )
}

// ─────────── 잠재 상세 ───────────
function PotentialDetail({ group, icon, worldIcon, methodIcons, onBack, nav }) {
  const { onScrollbarsInit, virtualizer } = useRowVirtualizer(group.records.length, 88)
  return (
    <MapleWindow
      title={detailTitle('POTENTIAL HISTORY', onBack)}
      titleRight={detailRight(nav)}
      bodyClassName="space-y-3"
    >
      {/* 요약 명패 — 닉네임(서버) 위, 아이템명 아래 */}
      <div className="rounded-xl p-4 flex items-center gap-4" style={CARD}>
        <ItemSlot url={icon} size={78} />
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-0.5 text-[13px] font-bold"
            style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}>
            {worldIcon && <img src={worldIcon} alt="" className="w-[18px] h-[18px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />}
            {group.character}
          </span>
          <div className="text-[21px] font-bold mt-0.5" style={{ color: 'var(--text-strong)' }}>{group.item}</div>
          <div className="text-[13px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{group.part} · Lv.{group.level}</div>
        </div>
      </div>

      {/* 아이템 통계 (목록 통계와 동일 구성) */}
      <PotentialStatsPanel stat={potentialStats(group.records)} methodIcons={methodIcons} compact />

      {/* 테이블 */}
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="flex items-center px-4 py-2.5 text-[13px] font-bold" style={SLATE_BAR}>
          <span className="w-[136px] shrink-0">일시</span>
          <span className="flex-1 min-w-0">수단</span>
          <span className="w-[262px] shrink-0 pr-3">변경 전</span>
          <span className="w-[262px] shrink-0">변경 후</span>
          <span className="w-[150px] text-right shrink-0">비용</span>
        </div>
        <OverlayScrollbarsComponent
          className="overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 340px)', minHeight: 320 }}
          options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'hidden', y: 'scroll' } }}
          events={{ initialized: onScrollbarsInit }}
          defer
        >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((v) => {
          const r = group.records[v.index]
          const idx = v.index
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
              ref={virtualizer.measureElement}
              data-index={v.index}
              className="flex items-center px-4 py-3 border-b text-[14px]"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${v.start}px)`,
                borderColor: 'var(--mpl-card-line)',
                background: idx % 2 === 1 ? 'var(--mpl-row)' : 'var(--mpl-card)',
              }}
            >
              <span className="w-[136px] shrink-0 leading-tight whitespace-nowrap">
                <span className="block text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>{date}</span>
                <span className="block text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{time}</span>
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-1 pr-3">
                <span className="flex items-center gap-1.5 min-w-0">
                  {mIcon
                    ? <img src={mIcon} alt="" className="w-[30px] h-[30px] object-contain shrink-0" style={{ imageRendering: 'pixelated' }} draggable={false} />
                    : <span className="w-[30px] h-[30px] shrink-0 flex items-center justify-center text-sm">💰</span>}
                  <span className="text-[13px] font-bold truncate" style={{ color: 'var(--text-muted)' }}>{r.methodName}</span>
                </span>
                {up ? (
                  <span
                    className="inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[12.5px] font-bold"
                    style={{ background: 'linear-gradient(180deg, #fdf6e3, #f7e9c8)', boxShadow: 'inset 0 0 0 1px #e6d3a4' }}
                  >
                    <GradeText grade={up.from} /><span style={{ color: '#b9a473', fontSize: 9 }}>▶</span><GradeText grade={up.to} />
                  </span>
                ) : r.upgrade_guarantee_count > 0 ? (
                  <span className="self-start rounded-full px-2 py-0.5 text-[12.5px] font-bold" style={PILL_GHOST}>
                    스택 {r.upgrade_guarantee_count}{ceiling ? ` / ${ceiling}` : ''}
                  </span>
                ) : null}
              </span>
              <span className="w-[262px] shrink-0 pr-3 leading-[1.5]">
                {(before || []).map((o, i) => (
                  <span key={i} className="block" style={{ color: GRADE_COLOR_SOFT[o.grade] || '#a6b4c0' }}>{o.value}</span>
                ))}
                {(!before || before.length === 0) && <span style={{ color: 'var(--text-dim)' }}>-</span>}
              </span>
              <span className="w-[262px] shrink-0 leading-[1.5] font-bold">
                {(after || []).map((o, i) => (
                  <span key={i} className="block" style={{ color: GRADE_COLOR[o.grade] || 'var(--text-muted)' }}>{o.value}</span>
                ))}
                {(!after || after.length === 0) && <span style={{ color: 'var(--text-dim)' }}>-</span>}
              </span>
              <span className="w-[150px] text-right shrink-0 font-bold tabular-nums text-[14px] whitespace-nowrap" style={{ color: 'var(--accent-bright)' }}>
                {cost != null ? formatKoreanMeso(cost) : '-'}
              </span>
            </div>
          )
        })}
        </div>
        </OverlayScrollbarsComponent>
      </div>
    </MapleWindow>
  )
}

// ─────────── 스타포스 상세 ───────────
function StarforceDetail({ group, icon, worldIcon, onBack, nav }) {
  const [showAllRanges, setShowAllRanges] = useState(false)
  // 기본은 2회 이상 시도한 구간만 (없으면 전체) — 나머지는 더보기로 펼침
  const allRanges = starRangeStats(group.records)
  const multi = allRanges.filter((s) => s.tries >= 2)
  const baseRanges = multi.length > 0 ? multi : allRanges
  const ranges = showAllRanges ? allRanges : baseRanges
  const hiddenRanges = allRanges.length - baseRanges.length
  const { onScrollbarsInit, virtualizer } = useRowVirtualizer(group.records.length, 62)
  return (
    <MapleWindow
      title={detailTitle('STARFORCE HISTORY', onBack)}
      titleRight={detailRight(nav)}
      bodyClassName="space-y-3"
    >
      <div className="rounded-xl p-4 flex items-center gap-4" style={CARD}>
        <ItemSlot url={icon} size={78} />
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-0.5 text-[13px] font-bold"
            style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}>
            {worldIcon && <img src={worldIcon} alt="" className="w-[18px] h-[18px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />}
            {group.character}
          </span>
          <div className="text-[21px] font-bold mt-0.5" style={{ color: 'var(--text-strong)' }}>{group.item}</div>
          <div className="text-lg font-bold mt-0.5 tabular-nums">
            <span style={{ color: '#c9a227' }}>★{group.startStar}</span>
            <span style={{ color: 'var(--text-dim)' }}> → </span>
            {group.destroyed ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span> : <span style={{ color: '#c9a227' }}>★{group.endStar}</span>}
          </div>
        </div>
      </div>

      {/* 아이템 통계 (목록 통계와 동일 톤) */}
      <div className="grid grid-cols-5 gap-2.5">
        <SummaryCard label="사용 메소" value={group.totalCost != null ? formatKoreanMeso(group.totalCost) : '-'} color="var(--accent-bright)" />
        <SummaryCard label="강화 시도" value={`${group.tries.toLocaleString()}회`} />
        <SummaryCard label="성공" value={`${group.success.toLocaleString()}회`} color="#4e9e20" />
        <SummaryCard label="하락" value={`${(group.dropCount || 0).toLocaleString()}회`} color={group.dropCount > 0 ? '#c9772a' : undefined} />
        <SummaryCard label="파괴" value={`${group.destroyCount.toLocaleString()}회`} color={group.destroyCount > 0 ? 'var(--mpl-red-to)' : undefined} />
      </div>

      {/* 구간별 성공률 */}
      {ranges.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={CARD}>
          <div className="flex items-center justify-between px-3.5 py-2 text-[13.5px] font-bold" style={SLATE_BAR}>
            <span>구간별 성공률</span>
            <span className="text-[13px] font-semibold" style={{ color: '#cfdae4' }}>시도 많은 순</span>
          </div>
          {ranges.map((s) => (
            <div key={s.star} className="flex items-center px-4 py-2.5 border-b last:border-b-0 text-[14px]" style={{ borderColor: 'var(--mpl-card-line)' }}>
              <span className="w-[124px] shrink-0 font-bold tabular-nums">
                <span style={{ color: '#c9a227' }}>★{s.star}</span> <span style={{ color: 'var(--text-dim)' }}>→</span> <span style={{ color: '#c9a227' }}>★{s.star + 1}</span>
              </span>
              <span className="flex-1 mr-3.5 h-[9px] rounded-full overflow-hidden" style={{ background: '#e4ebf1', boxShadow: 'inset 0 1px 2px rgba(31,44,61,.12)' }}>
                <span className="block h-full rounded-full" style={{ width: `${s.rate}%`, background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))' }} />
              </span>
              <span className="w-[60px] text-right font-bold tabular-nums">{s.rate.toFixed(1)}%</span>
              <span className="w-[124px] text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-strong)' }}>{s.tries}</b>회 · 파괴 <b style={{ color: s.destroy > 0 ? 'var(--mpl-red-to)' : 'var(--text-strong)' }}>{s.destroy}</b>
              </span>
            </div>
          ))}
          {hiddenRanges > 0 && (
            <button
              type="button"
              onClick={() => setShowAllRanges((v) => !v)}
              className="w-full py-2.5 text-[13px] font-bold hover:brightness-[.98]"
              style={{ background: 'var(--mpl-row)', color: 'var(--text-muted)' }}
            >
              {showAllRanges ? '접기 ▲' : `1회 시도 구간 ${hiddenRanges}개 더보기 ▼`}
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="flex items-center px-4 py-2.5 text-[13px] font-bold" style={SLATE_BAR}>
          <span className="w-[136px] shrink-0">일시</span>
          <span className="w-[170px] shrink-0">단계</span>
          <span className="flex-1">결과</span>
          <span className="w-[250px] text-right shrink-0">비용</span>
        </div>
        <OverlayScrollbarsComponent
          className="overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 420px)', minHeight: 300 }}
          options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'hidden', y: 'scroll' } }}
          events={{ initialized: onScrollbarsInit }}
          defer
        >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((v) => {
          const r = group.records[v.index]
          const idx = v.index
          const { date, time } = formatDateParts(r.date_create)
          const res = sfResult(r)
          const drop = isDrop(r)
          const cost = sfCost(r)
          return (
            <div
              key={r.id}
              ref={virtualizer.measureElement}
              data-index={v.index}
              className="flex items-center px-4 py-3 border-b text-[14px]"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${v.start}px)`,
                borderColor: 'var(--mpl-card-line)',
                background: res === 'destroy'
                  ? 'var(--mpl-row-danger, #fdf1ef)'
                  : idx % 2 === 1 ? 'var(--mpl-row)' : 'var(--mpl-card)',
                boxShadow: `inset 3px 0 0 ${
                  res === 'destroy' ? 'var(--mpl-red-to)'
                    : drop ? '#dd9231'
                      : res === 'success' ? '#7cbf3f'
                        : '#c2cdd8'
                }`,
              }}
            >
              <span className="w-[136px] shrink-0 leading-tight whitespace-nowrap">
                <span className="block text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>{date}</span>
                <span className="block text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{time}</span>
              </span>
              <span className="w-[170px] shrink-0 font-bold tabular-nums text-[15px]">
                {r.before_starforce_count}성 <span style={{ color: 'var(--text-dim)' }}>→</span>{' '}
                {res === 'destroy'
                  ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span>
                  : res === 'success'
                    ? <span style={{ color: 'var(--accent-bright)' }}>{r.after_starforce_count}성</span>
                    : `${r.after_starforce_count}성`}
              </span>
              <span className="flex-1 flex items-center gap-1.5">
                <span
                  className="rounded-md px-3.5 py-1 text-[14px] font-bold"
                  style={BADGE[drop ? 'drop' : res].style}
                >
                  {BADGE[drop ? 'drop' : res].label}
                </span>
                {flagApplied(r.chance_time) && (
                  <span className="rounded-md px-3 py-1 text-[13px] font-bold" style={{ background: 'linear-gradient(180deg, #ffd76e, #f0a828)', color: '#6b4b00' }}>찬스타임</span>
                )}
              </span>
              <span className="w-[250px] text-right shrink-0 tabular-nums whitespace-nowrap text-[14px]">
                {cost == null ? <span style={{ color: 'var(--text-dim)' }}>-</span> : (
                  <CostReasonTooltip cost={cost}>
                    {cost.final !== cost.base && <span className="text-[13px] line-through mr-1.5" style={{ color: 'var(--text-dim)' }}>{formatKoreanMeso(cost.base)}</span>}
                    <span className="font-bold" style={{ color: 'var(--accent-bright)' }}>{formatKoreanMeso(cost.final)}</span>
                  </CostReasonTooltip>
                )}
              </span>
            </div>
          )
        })}
        </div>
        </OverlayScrollbarsComponent>
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
  const [sort, setSort] = useState('cost')
  const [charFilter, setCharFilter] = useState(null)
  const [detailKey, setDetailKey] = useState(null)
  useBackClose(detailKey != null, () => setDetailKey(null))

  // 전체 기간 조회 (서버가 날짜별로 영구 캐시)
  const enabled = !!user
  const qOpts = { enabled, staleTime: 5 * 60 * 1000, retry: 1 }
  const sfQuery = useQuery({ queryKey: ['enchant', 'starforce', 'all'], queryFn: () => api('/api/enchant/history?type=starforce'), ...qOpts })
  const cubeQuery = useQuery({ queryKey: ['enchant', 'cube', 'all'], queryFn: () => api('/api/enchant/history?type=cube'), ...qOpts })
  const potQuery = useQuery({ queryKey: ['enchant', 'potential', 'all'], queryFn: () => api('/api/enchant/history?type=potential'), ...qOpts })

  // 원본 데이터에서 캐릭터·아이템 이름 수집 (아이콘/월드 조회 입력)
  const rawCharacterNames = useMemo(() => {
    const names = new Set()
    for (const i of sfQuery.data?.items || []) names.add(i.character_name)
    for (const i of cubeQuery.data?.items || []) names.add(i.character_name)
    for (const i of potQuery.data?.items || []) names.add(i.character_name)
    return [...names].filter(Boolean)
  }, [sfQuery.data, cubeQuery.data, potQuery.data])

  const itemNames = useMemo(() => {
    const set = new Set()
    for (const i of sfQuery.data?.items || []) set.add(i.target_item)
    for (const i of cubeQuery.data?.items || []) set.add(i.target_item)
    for (const i of potQuery.data?.items || []) set.add(i.target_item)
    return [...set].filter(Boolean).slice(0, 300)
  }, [sfQuery.data, cubeQuery.data, potQuery.data])

  const iconQuery = useQuery({
    queryKey: ['enchant', 'item-icons', rawCharacterNames.join(','), itemNames.length],
    queryFn: () => api(`/api/enchant/item-icons?characters=${encodeURIComponent(rawCharacterNames.join(','))}&items=${encodeURIComponent(itemNames.join(','))}`),
    enabled: enabled && rawCharacterNames.length > 0,
    staleTime: 60 * 60 * 1000,
  })
  const itemIcons = iconQuery.data?.items || {}
  const charInfo = useMemo(() => iconQuery.data?.characters || {}, [iconQuery.data])
  const worldIcons = useMemo(
    () => Object.fromEntries(Object.entries(charInfo).map(([n, v]) => [n, v.worldIcon])),
    [charInfo]
  )
  // 이벤트/테스트 월드 캐릭터는 통계에서 제외 (정보 조회 실패 시엔 포함)
  const excluded = useMemo(
    () => new Set(Object.entries(charInfo).filter(([, v]) => v.normalWorld === false).map(([n]) => n)),
    [charInfo]
  )

  const sfItems = useMemo(() => {
    let items = (sfQuery.data?.items || []).filter((i) => !excluded.has(i.character_name))
    if (charFilter) items = items.filter((i) => i.character_name === charFilter)
    return items
  }, [sfQuery.data, charFilter, excluded])

  const potRows = useMemo(() => {
    let rows = normalizePotential(cubeQuery.data?.items || [], potQuery.data?.items || [])
      .filter((i) => !excluded.has(i.character_name))
    if (charFilter) rows = rows.filter((i) => i.character_name === charFilter)
    return rows
  }, [cubeQuery.data, potQuery.data, charFilter, excluded])

  // 서버끼리 묶고(대표 = 최고 레벨), 서버 안에서는 레벨 내림차순. 조회 안 되는 캐릭터는 맨 뒤
  const sortedCharacters = useMemo(() => {
    const names = rawCharacterNames.filter((n) => !excluded.has(n))
    const topLevel = {}
    for (const n of names) {
      const w = charInfo[n]?.world
      if (!w) continue
      topLevel[w] = Math.max(topLevel[w] ?? 0, charInfo[n]?.level ?? 0)
    }
    return names.sort((a, b) => {
      const ia = charInfo[a]
      const ib = charInfo[b]
      const knownA = ia?.image ? 0 : 1
      const knownB = ib?.image ? 0 : 1
      if (knownA !== knownB) return knownA - knownB
      const wa = ia?.world || ''
      const wb = ib?.world || ''
      if (wa !== wb) return (topLevel[wb] ?? 0) - (topLevel[wa] ?? 0) || wa.localeCompare(wb, 'ko')
      return (ib?.level ?? 0) - (ia?.level ?? 0) || a.localeCompare(b, 'ko')
    })
  }, [rawCharacterNames, excluded, charInfo])

  const characterOptions = useMemo(() => [
    {
      value: null,
      label: '모든 캐릭터',
      hasIconSlot: true,
      iconElement: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--text-dim)' }}>
          <circle cx="7.5" cy="6.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.25 15.5c0-2.6 2.35-4.15 5.25-4.15s5.25 1.55 5.25 4.15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M13.25 4.35a2.6 2.6 0 0 1 0 4.9M14.5 11.9c2.05.45 3.35 1.85 3.35 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ),
    },
    ...sortedCharacters.map((n, i) => ({
      value: n,
      label: n,
      hasIconSlot: true,
      icon: charInfo[n]?.image || undefined,
      iconScale: 3,
      iconOffsetY: -3,
      subIcon: charInfo[n]?.worldIcon || undefined,
      sub: charInfo[n]?.level ? `Lv.${charInfo[n].level}` : undefined,
      // 서버가 바뀌는 지점에 구분선
      groupStart: i > 0 && charInfo[sortedCharacters[i - 1]]?.world !== charInfo[n]?.world,
    })),
  ], [sortedCharacters, charInfo])

  // 스타포스 이력엔 item_level이 없다 — 계정 장비·잠재 이력에서 얻은 실제 레벨을 비용 계산에 주입
  const itemLevelDict = useMemo(() => {
    const dict = { ...(iconQuery.data?.itemLevels || {}) }
    for (const r of potRows) {
      if (r.item_level && !dict[r.target_item]) dict[r.target_item] = r.item_level
    }
    return dict
  }, [iconQuery.data, potRows])

  const sfGroups = useMemo(() => {
    setDynamicItemLevels(itemLevelDict)
    return sortGroups(groupStarforce(sfItems), sort)
  }, [sfItems, sort, itemLevelDict])
  const sfSum = useMemo(() => {
    setDynamicItemLevels(itemLevelDict)
    return starforceSummary(sfItems)
  }, [sfItems, itemLevelDict])
  const potGroups = useMemo(() => sortGroups(groupPotential(potRows), sort), [potRows, sort])
  const potStat = useMemo(() => potentialStats(potRows), [potRows])

  const methodIconNames = useMemo(() => {
    const names = new Set()
    for (const g of potGroups) for (const m of g.methods) names.add(m.iconName)
    return [...names].sort()   // 정렬 순서가 바뀌어도 queryKey가 흔들리지 않도록 고정
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
    placeholderData: (prev) => prev,   // 목록이 바뀌어도 기존 아이콘 유지 (깜빡임 방지)
  })
  const methodIcons = methodIconQuery.data || {}

  // 탭 아이콘 (이미지 관리 등록분)
  const tabIconQuery = useQuery({
    queryKey: ['enchant', 'tab-icons'],
    queryFn: async () => {
      const [sf, pot] = await Promise.all([
        api('/api/images/' + encodeURIComponent('스타포스 HD')).catch(() => api('/api/images/' + encodeURIComponent('스타포스')).catch(() => null)),
        api('/api/images/' + encodeURIComponent('잠재능력 재설정')).catch(() => null),
      ])
      return { starforce: sf?.url || null, potential: pot?.url || null }
    },
    staleTime: Infinity,
  })
  const tabIcons = tabIconQuery.data || {}

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
  const activeGroups = tab === 'starforce' ? sfGroups : potGroups
  const detailIndex = detailKey ? activeGroups.findIndex((g) => g.key === detailKey) : -1
  const detailGroup = detailIndex >= 0 ? activeGroups[detailIndex] : null
  const periodLabel = '전체 기간'
  const detailNav = {
    periodLabel,
    index: detailIndex,
    total: activeGroups.length,
    onPrev: () => detailIndex > 0 && setDetailKey(activeGroups[detailIndex - 1].key),
    onNext: () => detailIndex < activeGroups.length - 1 && setDetailKey(activeGroups[detailIndex + 1].key),
  }

  return (
    <div className="pb-10 max-w-6xl mx-auto mpl-page-enter">
      {detailGroup ? (
        tab === 'starforce'
          ? <StarforceDetail group={detailGroup} icon={itemIcons[detailGroup.item]} worldIcon={worldIcons[detailGroup.character]} onBack={() => setDetailKey(null)} nav={detailNav} />
          : <PotentialDetail group={detailGroup} icon={itemIcons[detailGroup.item]} worldIcon={worldIcons[detailGroup.character]} methodIcons={methodIcons} onBack={() => setDetailKey(null)} nav={detailNav} />
      ) : (
        <MapleWindow
          title="ENCHANT HISTORY"
          titleRight={(
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 h-[38px] rounded-lg text-[13px] font-bold"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#cfdae4',
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" style={{ color: '#8fd0ff' }}>
                  <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                전체 기간
              </span>
              <Select value={charFilter} onChange={setCharFilter} options={characterOptions} className="w-36" />
              <Select value={sort} onChange={setSort} options={SORT_OPTIONS} className="w-36" />
            </div>
          )}
          tabs={[
            { key: 'starforce', label: '스타포스', icon: tabIcons.starforce },
            { key: 'potential', label: '잠재능력', icon: tabIcons.potential },
          ].map((t) => (
            <MapleWindowTab key={t.key} active={tab === t.key} onClick={() => { setTab(t.key); setDetailKey(null) }}>
              {t.icon && <GameIcon url={t.icon} size={22} />}
              {t.label}
            </MapleWindowTab>
          ))}
          bodyClassName="space-y-3"
        >
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
                <SummaryCard label="하락" value={`${sfSum.drop}회`} color="#c9772a" />
                <SummaryCard label="총 메소" value={sfSum.cost > 0 ? formatKoreanMeso(sfSum.cost) : '-'} color="var(--accent-bright)" ring="#eec584" />
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
                      cost={g.totalCost != null ? formatKoreanMeso(g.totalCost) : '-'}
                      ring={g.destroyCount > 0 ? '#f0b1a8' : null}
                      footer={<ResultStrip success={g.success} fail={g.tries - g.success - g.destroyCount} destroy={g.destroyCount} />}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <PotentialStatsPanel stat={potStat} methodIcons={methodIcons} />
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
                      cost={g.totalCost != null ? formatKoreanMeso(g.totalCost) : '-'}
                      costTip={{ resetCost: g.resetCost, feeCost: g.feeCost, total: g.totalCost }}
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
