import { Routes, Route, Navigate } from 'react-router-dom'
import MobileLayout from '../components/mobile/Layout'
import MobileHome from '../pages/mobile/Home'
import MobileFeaturePage from '../features/MobileFeaturePage'

export default function MobileRoutes() {
  return (
    <Routes>
      <Route element={<MobileLayout />}>
        <Route index element={<MobileHome />} />
        {/* 관리자는 PC 전용 — 모바일에서 접근 시 홈으로 */}
        <Route path="/admin/*" element={<Navigate to="/" replace />} />
        {/* 동적 기능 페이지 */}
        <Route path="/:slug/*" element={<MobileFeaturePage />} />
      </Route>
    </Routes>
  )
}
