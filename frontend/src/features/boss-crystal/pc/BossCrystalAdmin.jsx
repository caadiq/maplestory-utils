import { Routes, Route } from 'react-router-dom'
import BossList from './admin/BossList'
import BossForm from './admin/BossForm'

export default function BossCrystalAdmin() {
  return (
    <Routes>
      <Route index element={<BossList />} />
      <Route path="bosses/new" element={<BossForm />} />
      <Route path="bosses/:id" element={<BossForm />} />
    </Routes>
  )
}
