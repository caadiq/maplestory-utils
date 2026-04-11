import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import BossPage from './features/boss/BossPage'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/boss" element={<BossPage />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  )
}
