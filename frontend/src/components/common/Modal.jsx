import { motion, AnimatePresence } from 'framer-motion'

/**
 * 관리자 페이지에서 쓰는 일반 모달 래퍼
 * - 열기/닫기 애니메이션 포함
 * - 뒷배경 클릭으로는 닫히지 않음 (× 버튼만)
 */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'var(--dialog-backdrop)' }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${maxWidth} rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col`}
            style={{
              backgroundImage: 'linear-gradient(to bottom, var(--dialog-bg-from), var(--dialog-bg-to))',
              borderColor: 'var(--dialog-border)',
            }}
          >
            <div
              className="px-6 py-4 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: 'var(--panel-border)' }}
            >
              <h3 className="font-semibold" style={{ color: 'var(--text-strong)' }}>{title}</h3>
              <button
                onClick={onClose}
                className="text-xl leading-none hover:bg-[var(--row-hover-bg)] w-7 h-7 rounded flex items-center justify-center"
                style={{ color: 'var(--text-dim)' }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
