import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

/**
 * 진행 중인 퀘스트 드롭다운 (보스 초상화 + 이름)
 * @param {Array}  chapters  - { idx, boss, ... }[]
 * @param {string} imageBase - 보스 초상화 S3 base URL
 */
export default function QuestSelector({ chapters, imageBase, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // persist된 startChapter가 데이터 챕터 수보다 클 때 undefined → 크래시 방지
  const selected = chapters[value] ?? chapters[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-12 flex items-center gap-3 rounded-lg border pl-2 pr-3"
        style={{
          background: 'var(--input-bg)',
          borderColor: open ? 'var(--input-border-focus)' : 'var(--input-border)',
          color: 'var(--text-strong)',
        }}
      >
        <div
          className="w-9 h-9 rounded overflow-hidden shrink-0"
          style={{ background: 'var(--surface-nested)' }}
        >
          <img
            src={`${imageBase}/${selected?.boss}.webp`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <span className="flex-1 text-left text-sm font-medium">
          {selected?.boss}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--input-icon)' }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border overflow-hidden origin-top"
            style={{
              background: 'var(--popup-bg)',
              borderColor: 'var(--popup-border)',
              boxShadow: 'var(--popup-shadow)',
            }}
          >
            <OverlayScrollbarsComponent className="py-1" style={{ maxHeight: 288 }} options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'hidden', y: 'scroll' } }} defer>
          {chapters.map((chapter) => {
            const isSelected = chapter.idx === value
            return (
              <button
                key={chapter.idx}
                type="button"
                onClick={() => { onChange(chapter.idx); setOpen(false) }}
                className="w-full flex items-center gap-3 px-2 py-1.5"
                style={isSelected ? { background: 'var(--option-selected-bg)' } : undefined}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--row-hover-bg)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '' }}
              >
                <div
                  className="w-9 h-9 rounded overflow-hidden shrink-0"
                  style={{ background: 'var(--surface-nested)' }}
                >
                  <img
                    src={`${imageBase}/${chapter.boss}.webp`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <span
                  className="flex-1 text-left text-sm font-medium"
                  style={{ color: isSelected ? 'var(--option-selected-text)' : 'var(--text-emphasis)' }}
                >
                  {chapter.boss}
                </span>
              </button>
            )
          })}
          </OverlayScrollbarsComponent>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
