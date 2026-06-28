import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DIFFICULTIES, formatMeso } from '../pc/admin/constants'
import { LABEL_EN } from '../logic'

// 난이도 칩 테두리: easy/normal/hard는 bg=border라 안 보이므로 어두운 테두리로 대체
function chipBorder(d) {
  return d.colors.border === d.colors.bg ? 'rgba(0, 0, 0, 0.55)' : d.colors.border
}

// 모바일 전용 가격표 — fromis_9 일정 관리자 MemberSheet 바텀시트 패턴 이식
// 핵심: backdrop과 시트를 형제로 배치(backdrop opacity 애니가 시트에 영향 X), tween slide-up, blur 없음
export default function BossPriceModal({ open, onClose, bosses }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* backdrop (시트와 형제) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'var(--dialog-backdrop)' }}
            onClick={onClose}
          />

          {/* 시트 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.26, ease: 'easeOut' }}
            className="relative w-full rounded-t-3xl border-t shadow-2xl max-h-[85dvh] flex flex-col"
            style={{
              backgroundImage: 'linear-gradient(to bottom, var(--dialog-bg-from), var(--dialog-bg-to))',
              borderColor: 'var(--dialog-border)',
            }}
          >
            {/* 그래버 핸들 + 헤더 */}
            <div className="shrink-0 pt-3 px-5">
              <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--text-dim)', opacity: 0.35 }} />
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--panel-border)' }}>
                <h3 className="font-semibold" style={{ color: 'var(--text-strong)' }}>결정석 가격표</h3>
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

            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-3">
              {bosses.map((boss) => {
                const diffs = DIFFICULTIES.filter((d) => boss.difficulties.some((bd) => bd.difficulty === d.key))
                return (
                  <div key={boss.id} className="rounded-xl border p-3" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <img src={boss.image_url || '/default.png'} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-md object-cover shrink-0" />
                      <span className="text-base font-semibold" style={{ color: 'var(--text-strong)' }}>{boss.name}</span>
                    </div>
                    <div className="space-y-1.5">
                      {diffs.map((d) => {
                        const bd = boss.difficulties.find((x) => x.difficulty === d.key)
                        return (
                          <div key={d.key} className="flex items-center justify-between">
                            <span
                              className="inline-block rounded-full px-3 py-0.5 text-[11px] font-bold tracking-wider"
                              style={{ background: d.colors.bg, color: d.colors.text, border: `1.5px solid ${chipBorder(d)}` }}
                            >
                              {LABEL_EN[d.key] || d.key.toUpperCase()}
                            </span>
                            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--accent-bright)' }}>
                              {formatMeso(bd.crystal_price)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
