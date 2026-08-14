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

    /**
     * 스크롤 상태를 판단한다.
     *  - 'scroll'  : 굴릴 여지가 있는 뷰포트
     *  - null      : 굴릴 여지가 없음 → 뒤 페이지로 넘기지 않게 막는다
     *  - undefined : 아직 판단할 수 없음(스크롤바 컴포넌트가 준비 전) → 건드리지 않는다
     *
     * 준비 전을 '스크롤 불가'로 단정하면 그동안 휠을 통째로 막아버려서,
     * 목록을 열자마자 굴려도 아무 반응이 없다가 뒤늦게 되는 것처럼 보였다.
     */
    const scrollable = () => {
      const vp = el.querySelector('[data-overlayscrollbars-viewport]')
      if (!vp) return el.scrollHeight > el.clientHeight ? el : undefined
      return vp.scrollHeight > vp.clientHeight ? vp : null
    }

    const onWheel = (e) => {
      const vp = scrollable()
      if (vp === undefined) return
      if (!vp) { e.preventDefault(); return }
      const atTop = vp.scrollTop <= 0 && e.deltaY < 0
      const atEnd = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 1 && e.deltaY > 0
      if (atTop || atEnd) e.preventDefault()
    }
    const onTouchMove = (e) => {
      const vp = scrollable()
      if (vp === undefined) return
      if (!vp) e.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [ref, active])
}
