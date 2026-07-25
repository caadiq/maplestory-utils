import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * 관리자 페이지에서 쓰는 일반 모달 래퍼 (게임창 스타일)
 * - 열기/닫기 애니메이션 포함
 * - 뒷배경 클릭 또는 × 버튼으로 닫힘
 */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  // 모달이 열려 있는 동안 배경(body) 스크롤 잠금
  useEffect(() => {
    if (!open) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [open])

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
          onClick={onClose}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${maxWidth} rounded-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col`}
            style={{
              background: 'var(--mpl-card)',
              border: '1px solid rgba(31, 44, 61, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 게임창 타이틀바 */}
            <div
              className="px-5 py-3 flex items-center justify-between shrink-0"
              style={{ background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))' }}
            >
              <h3
                className="font-bold text-sm"
                style={{ color: 'var(--mpl-title-yellow)', letterSpacing: '1px', textShadow: '1px 1px 0 rgba(31,44,61,.6)' }}
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-xl leading-none w-7 h-7 rounded flex items-center justify-center hover:brightness-150"
                style={{ color: '#8b99a8' }}
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
