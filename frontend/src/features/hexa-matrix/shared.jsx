/**
 * 헥사 계산기 도메인 위젯/상수 (코어 카드·타입 색·재화 아이콘).
 * 게임창 공용 입력/레이아웃 위젯(CARD·NumInput·Seg·Toggle·SecTitle·FormRow)은
 * components/common/widgets 로 옮겼고, 기존 import 호환을 위해 여기서 재노출한다.
 */
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import Tooltip from '../../components/common/Tooltip'
import { fmtNum } from './logic'

export { CARD, SLATE_TITLE, NumInput, Seg, Toggle, SecTitle, FormRow } from '../../components/common/widgets'

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

