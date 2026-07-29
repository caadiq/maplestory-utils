import { useEffect } from 'react'

/**
 * 팝업 안에서 굴린 스크롤이 뒤 페이지로 넘어가지 않게 막는다.
 *
 * overscroll-behavior만으로는 부족하다 — 항목이 적어 스크롤 여지가 없는 팝업은
 * 브라우저가 스크롤 컨테이너로 보지 않아 그대로 상위로 전달한다.
 * 그래서 스크롤할 여지가 없을 때만 이벤트를 직접 막는다.
 */
export function useScrollChainBlock(ref, active) {
  useEffect(() => {
    const el = ref.current
    if (!el || !active) return

    const scrollable = () => {
      const vp = el.querySelector('[data-overlayscrollbars-viewport]') || el
      return vp.scrollHeight > vp.clientHeight ? vp : null
    }

    const onWheel = (e) => {
      const vp = scrollable()
      if (!vp) { e.preventDefault(); return }
      const atTop = vp.scrollTop <= 0 && e.deltaY < 0
      const atEnd = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 1 && e.deltaY > 0
      if (atTop || atEnd) e.preventDefault()
    }
    const onTouchMove = (e) => { if (!scrollable()) e.preventDefault() }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [ref, active])
}
