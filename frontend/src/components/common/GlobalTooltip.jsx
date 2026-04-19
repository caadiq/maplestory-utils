import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const DELAY_DEFAULT = 200

/**
 * 앱 루트에 한 번 마운트되는 전역 툴팁.
 * document에 이벤트 위임으로 [title] 또는 [data-tooltip] 를 가진 요소를 감지.
 *
 * 사용 측은 그냥 `title="설명"` 만 붙이면 됨:
 *   <button title="삭제">×</button>
 *
 * 커스텀 옵션:
 *   data-tooltip="..."              title 대신 사용 (native tooltip 피하고 싶을 때)
 *   data-tooltip-placement="top"    top | bottom | left | right (기본 top)
 *   data-tooltip-delay="300"        ms (기본 200)
 */
export default function GlobalTooltip() {
  const [state, setState] = useState({ open: false, text: '', placement: 'top', coords: null })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const timerRef = useRef(null)
  const titleMap = useRef(new WeakMap())

  useEffect(() => {
    function restoreTitle() {
      const el = triggerRef.current
      if (el && titleMap.current.has(el)) {
        const prev = titleMap.current.get(el)
        el.setAttribute('title', prev)
        titleMap.current.delete(el)
      }
    }

    function hide() {
      clearTimeout(timerRef.current)
      restoreTitle()
      triggerRef.current = null
      setState((s) => (s.open ? { ...s, open: false } : s))
    }

    function showFor(target) {
      const nativeTitle = target.getAttribute('title')
      const dataTooltip = target.getAttribute('data-tooltip')
      const text = nativeTitle || dataTooltip
      if (!text) return
      if (nativeTitle && !titleMap.current.has(target)) {
        titleMap.current.set(target, nativeTitle)
        target.removeAttribute('title')
      }
      const placement = target.getAttribute('data-tooltip-placement') || 'top'
      const delay = Number(target.getAttribute('data-tooltip-delay')) || DELAY_DEFAULT
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        triggerRef.current = target
        setState({ open: true, text, placement, coords: null })
      }, delay)
    }

    function handleOver(e) {
      const target = e.target.closest?.('[title], [data-tooltip]')
      if (!target) return
      if (triggerRef.current === target) return
      // 다른 타겟으로 이동 시 기존 정리
      if (triggerRef.current && triggerRef.current !== target) {
        restoreTitle()
        triggerRef.current = null
      }
      showFor(target)
    }

    function handleOut(e) {
      if (!triggerRef.current) return
      const rt = e.relatedTarget
      if (rt && triggerRef.current.contains(rt)) return
      hide()
    }

    function handleDown() { hide() }
    function handleKey(e) { if (e.key === 'Escape') hide() }

    document.addEventListener('mouseover', handleOver, true)
    document.addEventListener('mouseout', handleOut, true)
    document.addEventListener('focusin', handleOver, true)
    document.addEventListener('focusout', handleOut, true)
    document.addEventListener('mousedown', handleDown, true)
    document.addEventListener('keydown', handleKey, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)

    return () => {
      document.removeEventListener('mouseover', handleOver, true)
      document.removeEventListener('mouseout', handleOut, true)
      document.removeEventListener('focusin', handleOver, true)
      document.removeEventListener('focusout', handleOut, true)
      document.removeEventListener('mousedown', handleDown, true)
      document.removeEventListener('keydown', handleKey, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      clearTimeout(timerRef.current)
      restoreTitle()
    }
  }, [])

  // open 되면 위치 측정
  useLayoutEffect(() => {
    if (!state.open || !triggerRef.current || !tooltipRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const gap = 6
    let top, left
    switch (state.placement) {
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
    setState((s) => ({ ...s, coords: { top, left } }))
  }, [state.open, state.text, state.placement])

  if (!state.open) return null

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: state.coords?.top ?? 0,
        left: state.coords?.left ?? 0,
        zIndex: 9999,
        opacity: state.coords ? 1 : 0,
        transition: 'opacity 120ms ease-out',
        background: 'var(--tooltip-bg)',
        color: 'var(--tooltip-text)',
        borderColor: 'var(--tooltip-border)',
      }}
      className="pointer-events-none px-2 py-1 rounded-md border text-xs shadow-lg whitespace-nowrap"
    >
      {state.text}
    </div>,
    document.body,
  )
}
