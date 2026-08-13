import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 페이지를 옮기면 스크롤을 맨 위로.
 *
 * SPA라 라우팅해도 스크롤 위치가 그대로 남는다 — 긴 페이지(보스 계산기 등)를
 * 아래까지 보다가 다른 메뉴로 넘어가면 그 페이지 중간부터 보였다.
 *
 * pathname만 본다. 같은 페이지에서 쿼리스트링이나 해시만 바뀌는 경우
 * (탭 전환·앵커 이동)는 그대로 둔다.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
