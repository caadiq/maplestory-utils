import { BrowserView, MobileView } from 'react-device-detect'
import PCRoutes from './routes/pc'
import MobileRoutes from './routes/mobile'

export default function App() {
  return (
    <>
      <BrowserView>
        <PCRoutes />
      </BrowserView>
      <MobileView>
        <MobileRoutes />
      </MobileView>
    </>
  )
}
