import { motion, AnimatePresence } from 'framer-motion'
import { useBackClose } from '../../hooks/useBackClose'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  destructive = false,
  loading = false,
}) {
  useBackClose(open, onClose)

  const accent = destructive
    ? {
        ringColor: 'var(--ring-danger)',
        iconColor: 'var(--danger-text)',
        iconBg: 'var(--icon-danger-bg)',
        iconBorder: 'var(--icon-danger-border)',
      }
    : {
        ringColor: 'var(--ring-info)',
        iconColor: 'var(--accent-bright)',
        iconBg: 'var(--icon-info-bg)',
        iconBorder: 'var(--icon-info-border)',
      }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'var(--dialog-backdrop)' }}
          onClick={onClose}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl border shadow-2xl ring-1"
            style={{
              backgroundImage: 'linear-gradient(to bottom, var(--dialog-bg-from), var(--dialog-bg-to))',
              borderColor: 'var(--dialog-border)',
              '--tw-ring-color': accent.ringColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-3 flex items-start gap-4">
              <div
                className="shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center"
                style={{ background: accent.iconBg, borderColor: accent.iconBorder, color: accent.iconColor }}
              >
                {destructive ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.31 1.55 18.67 1.55 19.03C1.55 19.4 1.65 19.76 1.83 20.07C2 20.39 2.26 20.65 2.57 20.83C2.88 21.01 3.24 21.1 3.6 21.1H20.47C20.83 21.1 21.19 21.01 21.5 20.83C21.81 20.65 22.07 20.39 22.24 20.07C22.42 19.76 22.52 19.4 22.52 19.03C22.52 18.67 22.43 18.31 22.25 18L13.78 3.86C13.6 3.56 13.35 3.31 13.04 3.14C12.74 2.96 12.4 2.87 12.06 2.87C11.72 2.87 11.38 2.96 11.08 3.14C10.77 3.31 10.52 3.56 10.34 3.86H10.29Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8V12M12 16H12.01M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <h3
                className="flex-1 text-xl font-bold pt-1.5"
                style={{ color: 'var(--text-strong)' }}
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 -mt-1 -mr-1 rounded-lg hover:bg-[var(--row-hover-bg)] flex items-center justify-center text-xl leading-none"
                style={{ color: 'var(--text-dim)' }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="px-7 pt-4 pb-7">
              <p
                className="text-lg leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--text-muted)' }}
              >
                {description}
              </p>
            </div>
            <div
              className="flex gap-2 px-7 py-4 border-t"
              style={{ borderColor: 'var(--panel-border)' }}
            >
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border px-4 h-11 text-sm font-medium hover:bg-[var(--btn-bg-hover)] hover:border-[var(--btn-border-hover)]"
                style={{
                  background: 'var(--btn-bg)',
                  borderColor: 'var(--btn-border)',
                  color: 'var(--text-emphasis)',
                }}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 rounded-lg px-4 h-11 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: destructive ? 'var(--btn-danger-bg)' : 'var(--btn-primary-bg)',
                  color: destructive ? 'var(--btn-primary-text)' : 'var(--btn-primary-text)',
                  boxShadow: destructive ? 'var(--btn-danger-shadow)' : 'var(--btn-primary-shadow)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = destructive ? 'var(--btn-danger-bg-hover)' : 'var(--btn-primary-bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = destructive ? 'var(--btn-danger-bg)' : 'var(--btn-primary-bg)'
                }}
              >
                {loading ? '처리 중...' : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
