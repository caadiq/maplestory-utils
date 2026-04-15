import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GENESIS_CHAPTERS, QUEST_BOSS_IMAGE_BASE } from '../data'

/**
 * 진행 중인 퀘스트 드롭다운
 * - 보스 초상화 + 이름 텍스트
 */
export default function QuestSelector({ value, onChange }) {
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

  const selected = GENESIS_CHAPTERS[value]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-12 flex items-center gap-3 rounded-lg border bg-gray-950 pl-2 pr-3 transition ${
          open ? 'border-emerald-500/50' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <div className="w-9 h-9 rounded overflow-hidden shrink-0 bg-gray-900">
          <img
            src={`${QUEST_BOSS_IMAGE_BASE}/${selected.boss}.webp`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <span className="flex-1 text-left text-sm font-medium text-gray-100">
          {selected.boss}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none"
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
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
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-white/10 bg-gray-900 shadow-2xl py-1 max-h-72 overflow-y-auto origin-top"
          >
          {GENESIS_CHAPTERS.map((chapter) => {
            const isSelected = chapter.idx === value
            return (
              <button
                key={chapter.idx}
                type="button"
                onClick={() => { onChange(chapter.idx); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-2 py-1.5 transition ${
                  isSelected ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-9 h-9 rounded overflow-hidden shrink-0 bg-gray-950">
                  <img
                    src={`${QUEST_BOSS_IMAGE_BASE}/${chapter.boss}.webp`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className={`flex-1 text-left text-sm font-medium ${
                  isSelected ? 'text-emerald-300' : 'text-gray-200'
                }`}>
                  {chapter.boss}
                </span>
              </button>
            )
          })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
