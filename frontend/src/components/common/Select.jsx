import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * 커스텀 드롭다운 셀렉트 (포털로 렌더링 → 부모 overflow:hidden에도 잘림 없음)
 */
export default function Select({ value, onChange, options, disabled, className = '', placeholder = '선택', align = 'left' }) {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef(null)
  const popupRef = useRef(null)

  const updatePosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const estHeight = Math.min(options.length * 44 + 8, 240)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const flip = spaceBelow < estHeight && spaceAbove > spaceBelow
    setFlipUp(flip)
    setPos({
      top: flip ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      bottomOffset: flip ? window.innerHeight - rect.top : 0,
    })
  }

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target)) return
      if (popupRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScroll = () => updatePosition()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)

  const popup = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, y: flipUp ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: flipUp ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className={`fixed z-[100] rounded-lg border overflow-hidden ${
            flipUp ? 'origin-bottom' : 'origin-top'
          }`}
          style={{
            background: 'var(--popup-bg)',
            borderColor: 'var(--popup-border)',
            boxShadow: 'var(--popup-shadow)',
            color: 'var(--text-strong)',
            ...(flipUp
              ? { bottom: pos.bottomOffset + 4, left: pos.left, minWidth: pos.width }
              : { top: pos.top + 4, left: pos.left, minWidth: pos.width }
            ),
          }}
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => {
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2"
                  style={isActive ? {
                    background: 'var(--option-selected-bg)',
                    color: 'var(--option-selected-text)',
                  } : undefined}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--row-hover-bg)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = ''
                  }}
                >
                  {isActive && (
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <span className={!isActive ? 'pl-5' : ''}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none ${
          disabled ? 'opacity-50 !cursor-default' : ''
        }`}
        style={{
          background: 'var(--input-bg)',
          borderColor: open ? 'var(--input-border-focus)' : 'var(--input-border)',
          color: 'var(--text-strong)',
        }}
      >
        <span style={{ color: selected ? 'var(--text-strong)' : 'var(--input-placeholder)' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--input-icon)' }}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {createPortal(popup, document.body)}
    </div>
  )
}
