import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import { useBackClose } from '../../hooks/useBackClose'

function ImageModal({ data, onClose }) {
  useBackClose(true, onClose)

  /*
   * 배경 스크롤 잠금은 **html에만** 건다.
   *
   * body에 overflow:hidden을 주면 body가 스크롤 컨테이너가 되면서 상단 sticky 헤더가
   * 풀린다 — 실측: 헤더가 top 0에서 -150으로 밀려 화면 밖으로 나갔다.
   * 열려 있는 동안엔 배경에 가려 안 보이다가, 배경이 걷히는 순간 헤더가 사라진 채로
   * 한 프레임 그려져서 깜빡였다. html에만 걸면 헤더가 top 0을 유지한다.
   */
  useEffect(() => {
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = prev }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed top-0 left-0 z-50 flex flex-col"
      style={{ background: 'var(--dialog-backdrop)', width: '100vw', height: '100dvh' }}
      onClick={onClose}
    >
      <div className="shrink-0 flex items-center justify-end gap-2 p-3">
        {data.event_post_url && (
          <a
            href={data.event_post_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-lg border flex items-center justify-center"
            style={{ background: 'var(--btn-bg)', borderColor: 'var(--btn-border)', color: 'var(--text-emphasis)' }}
            aria-label="공식 공지로 이동"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M14 3h7m0 0v7m0-7L10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg border flex items-center justify-center text-xl leading-none"
          style={{ background: 'var(--btn-bg)', borderColor: 'var(--btn-border)', color: 'var(--text-emphasis)' }}
          aria-label="닫기"
        >×</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3" style={{ overscrollBehavior: 'contain' }}>
        <img
          src={data.image_url}
          alt="썬데이 메이플"
          className="w-full block rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </motion.div>
  )
}

export default function MobileSundayBanner() {
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['sunday-maple', 'current'],
    queryFn: () => api('/api/sunday-maple/current').catch(() => ({ available: false })),
    staleTime: 10 * 60 * 1000,
  })
  const iconName = data?.variant === 'special' ? '스페셜 썬데이 메이플' : '썬데이 메이플'
  const { data: iconData } = useQuery({
    queryKey: ['image', iconName],
    queryFn: () => api(`/api/images/${encodeURIComponent(iconName)}`).catch(() => null),
    enabled: !!data?.available,
    staleTime: Infinity,
  })

  if (!data?.available) return null
  const label = data.variant === 'special' ? '스페셜 썬데이 메이플' : '썬데이 메이플'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
        style={{
          background: 'linear-gradient(120deg, #f7dcab, #eec584)',
          boxShadow: 'inset 0 0 0 1px #e3b878, 0 3px 10px rgba(200,150,60,.2)',
        }}
      >
        <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px #e3c48f' }}>
          {iconData?.url ? <img src={iconData.url} alt={label} className="w-full h-full object-contain" /> : <span className="text-xl">📅</span>}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-bold text-sm" style={{ color: '#9a6a10' }}>이번 주 {label}</div>
          <div className="text-xs mt-0.5" style={{ color: '#b08a3e' }}>탭하여 혜택 확인</div>
        </div>
        <span className="shrink-0 text-xs font-bold" style={{ color: '#9a6a10' }}>보기 →</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && <ImageModal data={data} onClose={() => setOpen(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
