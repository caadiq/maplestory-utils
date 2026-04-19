import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'

function SundayMapleDialog({ data, onClose }) {
  return (
    <AnimatePresence>
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
          className="relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
          style={{
            background: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg backdrop-blur-sm border flex items-center justify-center text-xl leading-none hover:bg-[var(--row-hover-bg)]"
            style={{
              background: 'var(--btn-bg)',
              borderColor: 'var(--btn-border)',
              color: 'var(--text-emphasis)',
            }}
            aria-label="닫기"
          >
            ×
          </button>
          <img src={data.image_url} alt="썬데이 메이플" className="w-full block" />
          {data.event_post_url && (
            <div className="px-4 py-3 border-t text-center" style={{ borderColor: 'var(--panel-border)' }}>
              <a
                href={data.event_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-[var(--accent-hover-text)]"
                style={{ color: 'var(--accent)' }}
              >
                공식 공지 보기 →
              </a>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function SundayMapleBanner() {
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['sunday-maple', 'current'],
    queryFn: () => api('/api/sunday-maple/current').catch(() => ({ available: false })),
    staleTime: 10 * 60 * 1000,
  })

  // 이미지 관리에 업로드한 아이콘 URL (variant별)
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
        className="w-full rounded-2xl border p-4 flex items-center gap-4 transition-transform duration-300 hover:scale-[1.01]"
        style={{
          background: 'var(--selected-bg)',
          borderColor: 'var(--selected-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <div
          className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ background: 'var(--panel-bg)' }}
        >
          {iconData?.url ? (
            <img src={iconData.url} alt={label} className="w-full h-full object-contain" />
          ) : (
            <span className="text-2xl">📅</span>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-base" style={{ color: 'var(--accent-bright)' }}>
            이번 주 {label}
          </div>
          <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            일요일에 받을 수 있는 혜택을 확인하세요
          </div>
        </div>
        <div className="shrink-0 text-sm font-medium" style={{ color: 'var(--accent-bright)' }}>
          보기 →
        </div>
      </button>

      {open && <SundayMapleDialog data={data} onClose={() => setOpen(false)} />}
    </>
  )
}
