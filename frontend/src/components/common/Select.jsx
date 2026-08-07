import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { useScrollChainBlock } from '../../hooks/useScrollLock'

/**
 * 커스텀 드롭다운 셀렉트 (포털로 렌더링 → 부모 overflow:hidden에도 잘림 없음)
 *
 * showSub: 닫힌 상태에서도 option.sub를 오른쪽에 같이 보여준다.
 *   기본은 끔 — 기존 화면(캐릭터 선택 등)의 모양이 바뀌지 않도록 opt-in으로 뒀다.
 */
export default function Select({ value, onChange, options, disabled, className = '', placeholder = '선택', showSub = false }) {
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

  useScrollChainBlock(popupRef, open)

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
          <OverlayScrollbarsComponent
            className="py-1"
            style={{ maxHeight: 240 }}
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'hidden', y: 'scroll' } }}
            defer
          >
            {options.map((opt) => {
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full text-left pl-3 pr-5 py-2.5 text-sm flex items-center gap-2 ${opt.groupStart ? 'border-t' : ''}`}
                  style={{
                    ...(opt.groupStart ? { borderTopColor: 'var(--popup-border)' } : null),
                    ...(isActive ? {
                      background: 'var(--option-selected-bg)',
                      color: 'var(--option-selected-text)',
                    } : null),
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--row-hover-bg)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = ''
                  }}
                >
                  {opt.hasIconSlot && (
                    <span
                      className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ background: 'var(--surface-nested)' }}
                    >
                      {opt.iconElement ? opt.iconElement : opt.icon ? (
                        <img
                          src={opt.icon}
                          alt=""
                          className="w-full h-full object-contain select-none"
                          style={{
                            transform: `scale(${opt.iconScale || 1}) translateY(${opt.iconOffsetY ?? 0}%)`,
                          }}
                          draggable={false}
                        />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-dim)' }}>
                          <circle cx="8" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M2.75 13.5c0-2.5 2.35-4 5.25-4s5.25 1.5 5.25 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                  )}
                  {/* subIcon은 원본(32~38px)보다 작게 그려지는 축소라 pixelated를 쓰지 않는다 —
                      니어리스트로 줄이면 픽셀이 통째로 버려져 무늬가 깨진다 */}
                  <span className="flex items-center gap-1.5 min-w-0">
                    {opt.subIcon ? (
                      <img src={opt.subIcon} alt="" className="w-[18px] h-[18px] shrink-0 object-contain" draggable={false} />
                    ) : opt.hasIconSlot && !opt.noSubIcon && <span className="w-[18px] shrink-0" />}
                    <span className="truncate">{opt.label}</span>
                    {opt.sub && <span className="text-[13px] shrink-0" style={{ color: 'var(--text-dim)' }}>{opt.sub}</span>}
                  </span>
                </button>
              )
            })}
          </OverlayScrollbarsComponent>
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
        <span
          className="flex items-center gap-1.5 min-w-0"
          style={{ color: selected ? 'var(--text-strong)' : 'var(--input-placeholder)' }}
        >
          {selected?.subIcon && (
            <img src={selected.subIcon} alt="" className="w-4 h-4 shrink-0 object-contain" draggable={false} />
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          {showSub && selected?.sub && (
            <span className="text-[12.5px] font-bold shrink-0 ml-auto pl-2" style={{ color: 'var(--text-dim)' }}>
              {selected.sub}
            </span>
          )}
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
