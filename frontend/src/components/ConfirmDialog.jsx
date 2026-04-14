import { motion, AnimatePresence } from 'framer-motion'

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
  const accent = destructive
    ? { ring: 'ring-red-500/20', icon: 'text-red-300', iconBg: 'bg-red-500/10 border-red-500/30' }
    : { ring: 'ring-emerald-500/20', icon: 'text-emerald-300', iconBg: 'bg-emerald-500/10 border-emerald-500/30' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full max-w-md rounded-2xl bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 shadow-2xl ring-1 ${accent.ring}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-3 flex items-start gap-4">
              <div className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${accent.iconBg}`}>
                {destructive ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={accent.icon}>
                    <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.31 1.55 18.67 1.55 19.03C1.55 19.4 1.65 19.76 1.83 20.07C2 20.39 2.26 20.65 2.57 20.83C2.88 21.01 3.24 21.1 3.6 21.1H20.47C20.83 21.1 21.19 21.01 21.5 20.83C21.81 20.65 22.07 20.39 22.24 20.07C22.42 19.76 22.52 19.4 22.52 19.03C22.52 18.67 22.43 18.31 22.25 18L13.78 3.86C13.6 3.56 13.35 3.31 13.04 3.14C12.74 2.96 12.4 2.87 12.06 2.87C11.72 2.87 11.38 2.96 11.08 3.14C10.77 3.31 10.52 3.56 10.34 3.86H10.29Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={accent.icon}>
                    <path d="M12 8V12M12 16H12.01M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <h3 className="flex-1 text-xl font-bold text-white pt-1.5">{title}</h3>
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 -mt-1 -mr-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition flex items-center justify-center text-xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="px-7 pt-4 pb-7">
              <p className="text-lg text-gray-300 leading-relaxed whitespace-pre-line">{description}</p>
            </div>
            <div className="flex gap-2 px-7 py-4 border-t border-white/5">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-gray-200 px-4 h-11 text-sm font-medium transition"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 rounded-lg px-4 h-11 text-sm font-semibold transition disabled:opacity-50 ${
                  destructive
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                }`}
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
