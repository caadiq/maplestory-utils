import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import BossPage from './features/boss/BossPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/boss" element={<BossPage />} />
      </Route>
    </Routes>
  )
}
