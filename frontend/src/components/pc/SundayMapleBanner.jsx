import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../api/client'

function SundayMapleDialog({ data, onClose }) {
  // 배경 스크롤 잠금
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  const iconBtn = "w-8 h-8 rounded-lg backdrop-blur-sm border flex items-center justify-center hover:bg-[var(--row-hover-bg)]"
  const iconBtnStyle = {
    background: 'var(--btn-bg)',
    borderColor: 'var(--btn-border)',
    color: 'var(--text-emphasis)',
  }

  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed top-0 left-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{
        background: 'var(--dialog-backdrop)',
        width: '100vw',
        height: '100dvh',
      }}
      onClick={onClose}
    >
      <motion.div
        key="dialog"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[640px] max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {data.event_post_url && (
            <a
              href={data.event_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className={iconBtn}
              style={iconBtnStyle}
              aria-label="공식 공지로 이동"
              title="공식 공지로 이동"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M10 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M14 3h7m0 0v7m0-7L10 14"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
          <button
            onClick={onClose}
            className={`${iconBtn} text-xl leading-none`}
            style={iconBtnStyle}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <OverlayScrollbarsComponent
          className="flex-1 min-h-0"
          style={{ overscrollBehavior: 'contain' }}
          options={{
            scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 },
            overflow: { x: 'hidden', y: 'scroll' },
          }}
          defer
        >
          <img src={data.image_url} alt="썬데이 메이플" className="w-full block" />
        </OverlayScrollbarsComponent>
      </motion.div>
    </motion.div>
  )
}

export default function SundayMapleBanner() {
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
        className="w-full rounded-2xl p-4 flex items-center gap-4 transition-transform duration-300 hover:scale-[1.01]"
        style={{
          background: 'linear-gradient(120deg, #f7dcab, #eec584)',
          boxShadow: 'inset 0 0 0 2px #e3b878, 0 6px 18px rgba(227, 184, 120, .3)',
        }}
      >
        <div
          className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px #e3c48f' }}
        >
          {iconData?.url ? (
            <img src={iconData.url} alt={label} className="w-full h-full object-contain" />
          ) : (
            <span className="text-2xl">📅</span>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-base" style={{ color: '#9a6a10' }}>
            이번 주 {label}
          </div>
          <div className="text-sm mt-0.5" style={{ color: '#a1823f' }}>
            일요일에 받을 수 있는 혜택을 확인하세요
          </div>
        </div>
        <div className="shrink-0 text-sm font-bold" style={{ color: '#9a6a10' }}>
          보기 →
        </div>
      </button>

      <AnimatePresence>
        {open && <SundayMapleDialog data={data} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
