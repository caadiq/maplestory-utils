import { useCallback, useRef } from 'react'

/**
 * 구글폼 사이드 패널처럼 스크롤을 부드럽게 따라오는 sticky 효과
 * - 부모 컨테이너의 위/아래 경계를 넘지 않음
 * - lerp(선형보간)로 부드러운 움직임
 *
 * Callback ref 패턴이라 element가 마운트되는 시점에 자동 setup
 *
 * @returns {Function} ref 콜백
 */
export function useSmoothSticky({ offsetTop = 80, bottomMargin = 16, lerp = 0.18 } = {}) {
  const cleanupRef = useRef(null)

  return useCallback((el) => {
    // 이전 element의 cleanup
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    if (!el || !el.parentElement) return

    let rafId = null
    let target = 0
    let current = 0

    const calcTarget = () => {
      const containerRect = el.parentElement.getBoundingClientRect()
      const containerHeight = el.parentElement.offsetHeight
      const elementHeight = el.offsetHeight
      const viewportHeight = window.innerHeight
      const availableSpace = viewportHeight - offsetTop - bottomMargin
      const maxOffset = Math.max(0, containerHeight - elementHeight - bottomMargin)

      let desired
      if (elementHeight <= availableSpace) {
        // 패널이 viewport에 들어감 → 상단에 sticky
        desired = Math.max(0, offsetTop - containerRect.top)
      } else {
        // 패널이 viewport보다 큼 → 자연스럽게 스크롤되다가 하단이 viewport 하단에 닿으면 멈춤
        desired = Math.max(0, viewportHeight - bottomMargin - containerRect.top - elementHeight)
      }

      target = Math.min(desired, maxOffset)
    }

    const tick = () => {
      const diff = target - current
      if (Math.abs(diff) > 0.3) {
        current += diff * lerp
        el.style.transform = `translate3d(0, ${current}px, 0)`
        rafId = requestAnimationFrame(tick)
      } else {
        current = target
        el.style.transform = `translate3d(0, ${current}px, 0)`
        rafId = null
      }
    }

    const startTick = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      calcTarget()
      startTick()
    }

    // 초기 위치 설정
    calcTarget()
    current = target
    el.style.transform = `translate3d(0, ${current}px, 0)`
    el.style.willChange = 'transform'

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    ro.observe(el.parentElement)

    cleanupRef.current = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
      if (el.isConnected) {
        el.style.transform = ''
        el.style.willChange = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
