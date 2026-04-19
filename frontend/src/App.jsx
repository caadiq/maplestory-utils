import { isMobileOnly, isTablet } from 'react-device-detect'
import PCRoutes from './routes/pc'
import MobileRoutes from './routes/mobile'
import TabletRoutes from './routes/tablet'

export default function App() {
  if (isMobileOnly) return <MobileRoutes />
  if (isTablet) return <TabletRoutes />
  return <PCRoutes />
}
