/**
 * 헥사 계산기 PC·모바일 공용 위젯/상수.
 * 페이지 골격만 다르고 카드·입력·아이콘은 동일한 모양을 쓴다.
 */
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import Tooltip from '../../components/common/Tooltip'
import { fmtNum } from './logic'

/** 타입별 색 (섹션 테두리·헤더·카드 배경) */
export const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }
export const SLATE_TITLE = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}

export const TYPE_STYLE = {
  '스킬 코어': { line: '#ecd98b', accent: '#b8860b', bg: 'var(--hexa-skill-bg, #fff9e2)' },
  '마스터리 코어': { line: '#d8c5f0', accent: '#7a3fb0', bg: 'var(--hexa-mastery-bg, #f3edfc)' },
  '강화 코어': { line: '#bcdcf5', accent: '#1c6fae', bg: 'var(--hexa-enhance-bg, #e9f4fd)' },
  '공용 코어': { line: '#c4e3c2', accent: '#2e7d32', bg: 'var(--hexa-common-bg, #edf8ec)' },
}
export const TYPE_ORDER = ['스킬 코어', '마스터리 코어', '강화 코어', '공용 코어']

/** 재화 아이콘 (관리자 이미지 저장소에서) */
export 
function useResourceIcons() {
  const { data: erda } = useQuery({
    queryKey: ['image', '솔 에르다'],
    queryFn: () => api('/api/images/솔 에르다'),
    staleTime: Infinity,
  })
  const { data: frag } = useQuery({
    queryKey: ['image', '솔 에르다 조각'],
    queryFn: () => api('/api/images/솔 에르다 조각'),
    staleTime: Infinity,
  })
  return { erdaUrl: erda?.url, fragUrl: frag?.url }
}

export function ResIcon({ url, size = 19, className = '' }) {
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/* ── 입력 위젯 ─────────────────────────────────────────── */

export function NumInput({ value, onChange, min = 0, max = 9999, chars = 2, unit }) {
  const clamp = (v) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min))
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"
      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0))}
        className="bg-transparent outline-none text-right font-bold tabular-nums text-sm pr-[3px]"
        style={{ width: `${chars + 1.5}ch`, color: 'var(--text-strong)' }}
      />
      {unit && <span className="text-[12.5px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{unit}</span>}
    </div>
  )
}

export function Seg({ options, value, onChange, disabled }) {
  return (
    <div
      className="inline-flex rounded-lg overflow-hidden border text-[12.5px] font-bold"
      style={{ borderColor: 'var(--input-border)', opacity: disabled ? 0.45 : 1 }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className="px-3 py-2 disabled:cursor-not-allowed whitespace-nowrap"
          style={!disabled && o.value === value
            ? { background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))', color: '#fff' }
            : { background: 'var(--input-bg)', color: 'var(--text-muted)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, children, light }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-[13px] font-bold" style={{ color: light ? '#e8f2d9' : 'var(--text-muted)' }}>
      {children}
      <span
        className="relative inline-block w-9 h-5 rounded-full transition-colors"
        style={{ background: on ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' : 'var(--toggle-off, #c3ced9)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 18 : 2 }}
        />
      </span>
    </button>
  )
}

export function SecTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 rounded-t-[10px] text-[13px] font-extrabold tracking-wide" style={SLATE_TITLE}>
      {children}
      {right}
    </div>
  )
}

export function FormRow({ label, sub, children, total }) {
  if (total) {
    return (
      <div
        className="flex items-center justify-between gap-3 py-2.5 text-[13px] border-t -mx-3.5 -mb-1 px-3.5"
        style={{ borderColor: 'var(--mpl-card-line)', background: 'var(--mpl-row)' }}
      >
        <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-[13px] border-t border-dashed first:border-t-0" style={{ borderColor: 'var(--mpl-card-line)' }}>
      <span className="font-bold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
        {label}
        {sub && <span className="ml-1 text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>{sub}</span>}
      </span>
      {children}
    </div>
  )
}

export function CoreCard({ core, excluded, icons, compact = false }) {
  const st = TYPE_STYLE[core.type] || TYPE_STYLE['마스터리 코어']
  const pct = Math.round(core.progress * 100)
  const done = core.level >= 30
  // compact(모바일): 이름 대신 아이콘을 탭하면 말풍선으로 이름을 보여준다
  const [nameOpen, setNameOpen] = useState(false)
  const rootRef = useRef(null)
  useEffect(() => {
    if (!nameOpen) return undefined
    const close = (e) => { if (!rootRef.current?.contains(e.target)) setNameOpen(false) }
    const t = setTimeout(() => setNameOpen(false), 2500)
    document.addEventListener('pointerdown', close, true)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', close, true) }
  }, [nameOpen])
  return (
    <div
      ref={rootRef}
      className="relative flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5"
      style={{ background: st.bg, borderColor: st.line, opacity: excluded ? 0.45 : 1 }}
    >
      {compact && nameOpen && (
        <span
          className="absolute left-2 -top-3 z-10 rounded-lg px-2.5 py-1 text-[12px] font-bold text-white whitespace-nowrap max-w-[90%] overflow-hidden text-ellipsis"
          style={{ background: 'rgba(31,44,61,.92)', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}
        >
          {core.name}
        </span>
      )}
      <span
        className="relative w-11 h-11 shrink-0 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,.55)', boxShadow: '0 0 0 1px rgba(0,0,0,.15)' }}
        onClick={compact ? () => setNameOpen((v) => !v) : undefined}
        role={compact ? 'button' : undefined}
      >
        {core.icon
          ? <img src={core.icon} alt={core.name} width={32} height={32} style={{ imageRendering: 'pixelated' }} />
          : <span className="text-lg">?</span>}
        <b className="absolute -right-1 -bottom-1 text-[11px] text-white rounded-md px-1" style={{ background: '#2a3644', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }}>{core.level}</b>
      </span>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 mb-1 ${compact ? 'justify-end' : 'justify-between'}`}>
          {!compact && (
            /*
              Tooltip 래퍼(span.inline-block)는 콘텐츠 폭만큼 커져서 flex 안에서 줄어들지 않는다.
              바깥 div에서 폭을 자르고(overflow-hidden) 래퍼가 그 폭을 따르게 [&>span]:block 처리.
            */
            <div className="min-w-0 overflow-hidden [&>span]:block [&>span]:max-w-full">
              <Tooltip text={core.name}>
                <b className="text-[13px] truncate block" style={{ color: 'var(--text-strong)' }}>{core.name}</b>
              </Tooltip>
            </div>
          )}
          {excluded ? (
            <span className="text-[12px] font-bold shrink-0" style={{ color: 'var(--text-dim)' }}>제외됨</span>
          ) : done ? (
            <span className="text-[11.5px] font-extrabold rounded-full px-2 py-0.5 shrink-0" style={{ color: '#4c8a2f', background: 'rgba(159,212,94,.25)', border: '1px solid rgba(125,185,58,.5)' }}>완료</span>
          ) : (
            <span className="flex items-center gap-2 text-[12.5px] font-extrabold tabular-nums shrink-0" style={{ color: 'var(--text-strong)' }}>
              <span className="inline-flex items-center gap-1"><ResIcon url={icons.erdaUrl} />{fmtNum(core.remainErda)}</span>
              <span className="inline-flex items-center gap-1"><ResIcon url={icons.fragUrl} />{fmtNum(core.remainFrag)}</span>
            </span>
          )}
        </div>
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'rgba(31,44,61,.14)' }}>
          <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ffb45e, #f07a3a)', transition: 'width .6s cubic-bezier(.22, 1, .36, 1)' }} />
          {/* 라벨은 중앙 — 채움이 절반을 넘으면 주황 위(흰 글씨), 아니면 연한 배경 위(어두운 글씨) */}
          <span
            className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold tabular-nums"
            style={pct >= 50
              ? { color: '#ffffff', textShadow: '0 1px 1px rgba(0,0,0,.35)' }
              : { color: 'var(--text-strong)' }}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  )
}

