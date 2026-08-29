import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useBackClose } from '../../hooks/useBackClose'

/**
 * 관리자 페이지에서 쓰는 일반 모달 래퍼 (게임창 스타일)
 * - 열기/닫기 애니메이션 포함
 * - 뒷배경 클릭 또는 × 버튼으로 닫힘
 */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  useBackClose(open, onClose)

  /*
   * 배경 스크롤 잠금 — **html에만** 건다.
   *
   * body에 overflow:hidden을 주면 body가 스크롤 컨테이너가 되면서 상단 sticky 헤더가
   * 풀린다 — 실측: 헤더가 top 0에서 -150으로 밀려 화면 밖으로 나갔다.
   * 열려 있는 동안엔 배경에 가려 안 보이다가, 배경이 걷히는 순간 헤더가 사라진 채로
   * 한 프레임 그려져서 깜빡였다. html만 잠가도 스크롤은 그대로 막힌다(실측).
   */
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = prev }
  }, [open])

  // body로 포털 — 페이지 페이드 애니메이션의 stacking context에 갇혀 헤더 아래로 깔리는 것 방지
  return createPortal(
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
    </AnimatePresence>,
    document.body,
  )
}
