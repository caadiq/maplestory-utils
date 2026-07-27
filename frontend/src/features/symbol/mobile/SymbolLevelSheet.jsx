import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Select from '../../../components/common/Select'
import { formatMeso } from '../../../utils/formatting'
import { TYPE_ORDER } from '../utils'
import { useBackClose } from '../../../hooks/useBackClose'
import { REGION_COLOR } from '../pc/user/SymbolLevelTableModal'

// 모바일 전용 레벨별 강화 비용표 — 바텀시트
// 지역이 많아 가로 스크롤은 불편하므로: 타입 세그먼트 + 지역 드롭다운 → 레벨/개수/비용 3열
export default function SymbolLevelSheet({ open, onClose, allSymbols }) {
  useBackClose(open, onClose)

  const byType = {}
  for (const s of allSymbols) (byType[s.type] ??= []).push(s)
  const types = TYPE_ORDER.filter((t) => byType[t])

  const [pickedType, setPickedType] = useState(null)
  const type = pickedType && byType[pickedType] ? pickedType : types[0]
  const group = type ? byType[type] : []

  const [pickedRegion, setPickedRegion] = useState(null)
  const sym = group.find((s) => s.id === pickedRegion) || group[0]
  const regionOptions = group.map((s) => ({ value: s.id, label: s.region }))

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'var(--dialog-backdrop)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.26, ease: 'easeOut' }}
            className="relative w-full rounded-t-3xl border-t shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden"
            style={{
              background: 'var(--dialog-bg-from)',
              borderColor: 'var(--dialog-border)',
            }}
          >
            {/* 핸들 + 헤더 */}
            <div className="shrink-0 pt-3 px-5">
              <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--text-dim)', opacity: 0.35 }} />
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--panel-border)' }}>
                <h3 className="font-semibold" style={{ color: 'var(--text-strong)' }}>레벨별 강화 비용표</h3>
                <button
                  onClick={onClose}
                  className="text-xl leading-none w-7 h-7 -mr-1 rounded flex items-center justify-center"
                  style={{ color: 'var(--text-dim)' }}
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 타입 세그먼트 + 지역 드롭다운 */}
            <div className="shrink-0 px-4 pt-3 space-y-2">
              <div
                className="flex gap-1.5 p-1.5 rounded-xl"
                style={{
                  background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))',
                  boxShadow: '0 3px 10px rgba(31,44,61,.25)',
                }}
              >
                {types.map((t) => {
                  const active = t === type
                  const icon = byType[t]?.[0]?.image_url
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPickedType(t)}
                      className="flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg whitespace-nowrap"
                      style={active
                        ? {
                            background: 'linear-gradient(180deg, var(--mpl-sky-from), #41b5e6)',
                            color: '#ffffff',
                            textShadow: '0 1px 2px rgba(31,80,110,.4)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
                          }
                        : {
                            background: 'linear-gradient(180deg, #44566b, #3a4a5c)',
                            color: '#9fb0c1',
                          }}
                    >
                      {icon && <img src={icon} alt="" className="w-5 h-5 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className="text-[12px] font-semibold leading-tight text-center">{t}</span>
                    </button>
                  )
                })}
              </div>
              {sym && (
                <Select
                  value={sym.id}
                  onChange={(v) => setPickedRegion(v)}
                  options={regionOptions}
                />
              )}
            </div>

            {/* 표 헤더 (스크롤 영역 밖에 고정) */}
            {sym && (
              <div
                className="shrink-0 mt-3 mx-4 flex items-center px-3.5 py-2 text-sm font-bold rounded-lg"
                style={{
                  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
                  color: '#ffffff',
                  textShadow: '0 1px 1px rgba(44,55,69,.3)',
                }}
              >
                <span className="w-20 shrink-0">레벨</span>
                <span className="flex-1 text-center">개수</span>
                <span className="flex-1 text-right">비용</span>
              </div>
            )}

            {/* 레벨별 본문 (스크롤) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {sym ? (
                sym.levels.map((lv, i) => (
                  <div
                    key={lv.level}
                    className="flex items-center px-2 py-2.5 text-sm"
                    style={{ background: i % 2 === 1 ? 'var(--row-stripe, rgba(128,128,128,0.06))' : 'transparent' }}
                  >
                    <span className="w-20 shrink-0 font-semibold tabular-nums" style={{ color: REGION_COLOR[sym.region] || 'var(--accent-bright)' }}>
                      {lv.level} <span style={{ color: 'var(--text-dim)' }}>→</span> {lv.level + 1}
                    </span>
                    <span className="flex-1 text-center tabular-nums font-medium" style={{ color: 'var(--warning-text-bright)' }}>
                      {lv.required_count.toLocaleString()}
                    </span>
                    <span className="flex-1 text-right tabular-nums" style={{ color: 'var(--text-strong)' }}>
                      {formatMeso(lv.meso_cost)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>표시할 심볼 데이터가 없습니다</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
