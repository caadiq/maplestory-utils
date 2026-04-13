import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * 커스텀 툴팁
 * <Tooltip text="설명">
 *   <button>...</button>
 * </Tooltip>
 */
export default function Tooltip({ text, children, placement = 'top', delay = 200 }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null) // null이면 위치 측정 전 (안 보임)
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const timerRef = useRef(null)

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const gap = 6

    let top, left
    switch (placement) {
      case 'bottom':
        top = trigger.bottom + gap
        left = trigger.left + trigger.width / 2 - tooltip.width / 2
        break
      case 'left':
        top = trigger.top + trigger.height / 2 - tooltip.height / 2
        left = trigger.left - tooltip.width - gap
        break
      case 'right':
        top = trigger.top + trigger.height / 2 - tooltip.height / 2
        left = trigger.right + gap
        break
      case 'top':
      default:
        top = trigger.top - tooltip.height - gap
        left = trigger.left + trigger.width / 2 - tooltip.width / 2
    }

    const padding = 4
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltip.width - padding))
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltip.height - padding))

    setCoords({ top, left })
  }

  // open 상태가 true가 되면 즉시 위치 측정 (paint 전에)
  useLayoutEffect(() => {
    if (open) updatePosition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = () => updatePosition()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setOpen(true), delay)
  }
  const handleLeave = () => {
    clearTimeout(timerRef.current)
    setOpen(false)
    setCoords(null)
  }

  if (!text) return children

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className="inline-block"
      >
        {children}
      </span>
      {open && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: coords?.top ?? 0,
            left: coords?.left ?? 0,
            zIndex: 9999,
            opacity: coords ? 1 : 0,
            transition: 'opacity 120ms ease-out',
          }}
          className="pointer-events-none px-2 py-1 rounded-md bg-gray-900 border border-white/10 text-xs text-gray-200 shadow-lg whitespace-nowrap"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}
