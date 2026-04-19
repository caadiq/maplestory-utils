import { isMobileOnly, isTablet } from 'react-device-detect'
import PCRoutes from './routes/pc'
import MobileRoutes from './routes/mobile'
import TabletRoutes from './routes/tablet'
import GlobalTooltip from './components/common/GlobalTooltip'

function Routes() {
  if (isMobileOnly) return <MobileRoutes />
  if (isTablet) return <TabletRoutes />
  return <PCRoutes />
}

export default function App() {
  return (
    <>
      <Routes />
      <GlobalTooltip />
    </>
  )
}
