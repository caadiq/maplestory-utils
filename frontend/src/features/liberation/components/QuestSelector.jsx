import { useState, useEffect, useRef } from 'react'
import { GENESIS_CHAPTERS, QUEST_BTBOSS_IMAGE_BASE } from '../data'

/**
 * 진행 중인 퀘스트 드롭다운
 * - 선택된 옵션과 옵션 리스트 모두 btboss 이미지로 표시
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
        className={`relative w-full h-12 flex items-center justify-center rounded-lg border bg-gray-950 px-3 transition ${
          open ? 'border-emerald-500/50' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <img
          src={`${QUEST_BTBOSS_IMAGE_BASE}/${selected.boss}.png`}
          alt={selected.boss}
          className="h-8 block"
        />
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none"
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 flex flex-col items-center gap-1">
          {GENESIS_CHAPTERS.map((chapter) => {
            const isSelected = chapter.idx === value
            return (
              <button
                key={chapter.idx}
                type="button"
                onClick={() => { onChange(chapter.idx); setOpen(false) }}
                className={`relative transition ${
                  isSelected ? 'scale-105' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={`${QUEST_BTBOSS_IMAGE_BASE}/${chapter.boss}.png`}
                  alt={chapter.boss}
                  className="h-10 block drop-shadow-lg"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
