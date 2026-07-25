import { useState } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import Modal from '../../../../components/common/Modal'
import { formatMeso } from '../../../../utils/formatting'
import { TYPE_ORDER } from '../../utils'

// 지역별 색 — 각 심볼 이미지의 대표색에서 추출 (카르시온은 실제 문양의 에메랄드빛으로 보정)
const REGION_COLOR = {
  '소멸의 여로': '#4893b2',
  '츄츄 아일랜드': '#b24faf',
  '레헬른': '#5c2ab2',
  '아르카나': '#474b9f',
  '모라스': '#b2424a',
  '에스페라': '#6a50b2',
  '세르니움': '#508cb2',
  '아르크스': '#9e6547',
  '오디움': '#b29550',
  '도원경': '#b2506f',
  '아르테리아': '#5052b2',
  '카르시온': '#2fa48a',
  '탈라하트': '#75459b',
  '기어드락': '#b28e39',
}
const FALLBACK_COLORS = ['#2f9fd8', '#8d5fd3', '#d63d82', '#b07a1f', '#21a695', '#5b6ed9']

// 심볼 타입별 레벨 강화 비용표
// - 필요 개수(required_count)는 타입 내 지역 공통, 비용(meso_cost)은 지역마다 달라 지역별 열로 표시
// - 헤더는 스크롤 영역 밖 고정 (sticky는 행이 헤더 위로 비치는 문제가 있어 미사용)
export default function SymbolLevelTableModal({ open, onClose, allSymbols }) {
  const byType = {}
  for (const s of allSymbols) (byType[s.type] ??= []).push(s)
  const types = TYPE_ORDER.filter((t) => byType[t])

  const [picked, setPicked] = useState(null)
  const type = picked && byType[picked] ? picked : types[0]
  const group = type ? byType[type] : []
  const base = group[0] // 필요 개수 기준 (지역 공통)

  const gridStyle = { gridTemplateColumns: `88px 96px repeat(${Math.max(group.length, 1)}, 1fr)` }

  return (
    <Modal open={open} onClose={onClose} title="레벨별 강화 비용표" maxWidth="max-w-5xl">
      {/* 타입 세그먼트 */}
      <div className="px-5 pt-4 shrink-0">
        <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--surface-2)', boxShadow: 'inset 0 0 0 1px #d4dde5' }}>
          {types.map((t) => {
            const active = t === type
            const icon = byType[t]?.[0]?.image_url
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPicked(t)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full text-sm font-bold whitespace-nowrap transition"
                style={active
                  ? {
                      background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(31,80,110,.4)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
                    }
                  : { color: 'var(--text-muted)' }}
              >
                {icon && <img src={icon} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} />}
                {t} 심볼
              </button>
            )
          })}
        </div>
      </div>

      {/* 표 헤더 (청회색 필 바, 고정) */}
      <div className="px-5 pt-3 shrink-0">
        <div
          className="grid items-center px-3 py-2.5 rounded-lg text-sm font-bold"
          style={{
            ...gridStyle,
            background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
            color: '#ffffff',
            textShadow: '0 1px 1px rgba(44,55,69,.3)',
          }}
        >
          <span>레벨</span>
          <span className="text-center">필요 개수</span>
          {group.map((s) => (
            <span key={s.id} className="text-right">{s.region}</span>
          ))}
        </div>
      </div>

      {/* 본문 (스크롤) */}
      <OverlayScrollbarsComponent
        className="flex-1 min-h-0 px-5 pb-4"
        options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 } }}
        defer
      >
        {base ? (
          base.levels.map((lv, i) => (
            <div
              key={lv.level}
              className="grid items-center px-3 py-2.5 rounded-lg text-[15px]"
              style={{ ...gridStyle, background: i % 2 === 1 ? 'var(--row-hover-bg)' : 'transparent' }}
            >
              <span className="font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>
                {lv.level} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>→</span> {lv.level + 1}
              </span>
              <span className="text-center tabular-nums font-semibold" style={{ color: 'var(--warning-text-bright)' }}>
                {lv.required_count.toLocaleString()}
              </span>
              {group.map((s, gi) => {
                const cell = s.levels.find((x) => x.level === lv.level)
                return (
                  <span
                    key={s.id}
                    className="text-right tabular-nums font-semibold"
                    style={{ color: cell ? (REGION_COLOR[s.region] || FALLBACK_COLORS[gi % FALLBACK_COLORS.length]) : 'var(--text-dim)' }}
                  >
                    {cell ? formatMeso(cell.meso_cost) : '-'}
                  </span>
                )
              })}
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>표시할 심볼 데이터가 없습니다</div>
        )}
      </OverlayScrollbarsComponent>
    </Modal>
  )
}
