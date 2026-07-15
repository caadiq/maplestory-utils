import { useState } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import Modal from '../../../../components/common/Modal'
import { formatMeso } from '../../../../utils/formatting'
import { TYPE_ORDER } from '../../utils'

// 심볼 타입별 레벨 강화 비용표
// - 필요 개수(required_count)는 타입 내 지역 공통, 비용(meso_cost)은 지역마다 달라 지역별 열로 표시
export default function SymbolLevelTableModal({ open, onClose, allSymbols }) {
  const byType = {}
  for (const s of allSymbols) (byType[s.type] ??= []).push(s)
  const types = TYPE_ORDER.filter((t) => byType[t])

  const [picked, setPicked] = useState(null)
  const type = picked && byType[picked] ? picked : types[0]
  const group = type ? byType[type] : []
  const base = group[0] // 필요 개수 기준 (지역 공통)

  return (
    <Modal open={open} onClose={onClose} title="레벨별 강화 비용표" maxWidth="max-w-5xl">
      {/* 타입 세그먼트 */}
      <div className="px-6 pt-4 shrink-0">
        <div className="flex gap-1 p-1 rounded-xl border" style={{ background: 'var(--surface-3)', borderColor: 'var(--panel-border)' }}>
          {types.map((t) => {
            const active = t === type
            const icon = byType[t]?.[0]?.image_url
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPicked(t)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-semibold whitespace-nowrap"
                style={active
                  ? { background: 'var(--selected-bg)', color: 'var(--accent-bright)' }
                  : { color: 'var(--text-muted)' }}
              >
                {icon && <img src={icon} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} />}
                {t} 심볼
              </button>
            )
          })}
        </div>
      </div>

      <OverlayScrollbarsComponent
        className="flex-1 min-h-0 px-6 py-4"
        options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 } }}
        defer
      >
        {base ? (
          <table className="w-full text-base border-collapse whitespace-nowrap">
            <thead>
              <tr style={{ background: 'var(--dialog-bg-from)' }}>
                <th className="sticky top-0 z-10 text-left font-semibold px-4 py-3.5 border-b-2" style={{ background: 'var(--dialog-bg-from)', borderColor: 'var(--panel-border)', color: 'var(--text-emphasis)' }}>
                  레벨
                </th>
                <th className="sticky top-0 z-10 text-center font-semibold px-4 py-3.5 border-b-2 border-r" style={{ background: 'var(--dialog-bg-from)', borderColor: 'var(--panel-border)', color: 'var(--text-emphasis)' }}>
                  필요 개수
                </th>
                {group.map((s) => (
                  <th key={s.id} className="sticky top-0 z-10 text-right font-semibold px-4 py-3.5 border-b-2" style={{ background: 'var(--dialog-bg-from)', borderColor: 'var(--panel-border)', color: 'var(--text-strong)' }}>
                    {s.region}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {base.levels.map((lv, i) => (
                <tr key={lv.level} style={{ background: i % 2 === 1 ? 'var(--row-stripe, rgba(128,128,128,0.06))' : 'transparent' }}>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--accent-bright)' }}>
                    {lv.level} <span style={{ color: 'var(--text-dim)' }}>→</span> {lv.level + 1}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-medium border-r" style={{ color: 'var(--warning-text-bright)', borderColor: 'var(--panel-border)' }}>
                    {lv.required_count.toLocaleString()}
                  </td>
                  {group.map((s) => {
                    const cell = s.levels.find((x) => x.level === lv.level)
                    return (
                      <td key={s.id} className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-strong)' }}>
                        {cell ? formatMeso(cell.meso_cost) : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>표시할 심볼 데이터가 없습니다</div>
        )}
      </OverlayScrollbarsComponent>
    </Modal>
  )
}
