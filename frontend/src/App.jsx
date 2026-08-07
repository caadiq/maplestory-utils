import { useState, useEffect } from 'react'
import PCRoutes from './routes/pc'
import MobileRoutes from './routes/mobile'
import GlobalTooltip from './components/common/GlobalTooltip'

/**
 * 모바일/PC는 **뷰포트 폭(matchMedia)** 하나로 판정한다. UA는 보지 않는다.
 *
 * - ~1099px: 모바일 레이아웃 (폰, 폰 가로, 태블릿 세로)
 * - 1100px~: PC 레이아웃 (데스크톱, 태블릿 가로 — 갤럭시탭 가로는 DPR 때문에 CSS 폭이 1100대라 1280 경계로는 모바일로 떨어졌다)
 *
 * 1100 경계는 보스 계산기의 2열 화면이 성립하는 최소 폭 기준이다.
 * matchMedia를 쓰는 이유: 개발자 도구 기기 에뮬레이션에서 innerWidth 갱신이나
 * resize 이벤트가 브라우저에 따라 누락돼도, CSS 미디어쿼리는 토글 즉시 재평가된다.
 * (이전에는 react-device-detect(UA)로 판정 → 로드 시 굳는 값이라 전환이 안 됐다)
 */
const pcMq = window.matchMedia('(min-width: 1100px)')

function useViewportKind() {
  const get = () => (pcMq.matches ? 'pc' : 'mobile')
  const [kind, setKind] = useState(get)
  useEffect(() => {
    const update = () => setKind(get())
    pcMq.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      pcMq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return kind
}

export default function App() {
  const kind = useViewportKind()
  return (
    <>
      {kind === 'mobile' ? <MobileRoutes /> : <PCRoutes />}
      <GlobalTooltip />
    </>
  )
}
