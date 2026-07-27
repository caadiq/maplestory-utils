import { Routes, Route } from 'react-router-dom'
import Layout from '../components/pc/Layout'
import Home from '../pages/pc/Home'
import FeaturePage from '../features/FeaturePage'
import AdminLayout from '../features/admin/pc/AdminLayout'
import AdminHome from '../features/admin/pc/AdminHome'
import AdminImages from '../features/admin/pc/AdminImages'
import AdminChallengerSeasons from '../features/admin/pc/AdminChallengerSeasons'
import AdminMenuForm from '../features/admin/pc/AdminMenuForm'
import AdminFeaturePage from '../features/admin/pc/AdminFeaturePage'

export default function PCRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />

        {/* 관리자 */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="images" element={<AdminImages />} />
          <Route path="challenger-seasons" element={<AdminChallengerSeasons />} />
          <Route path="menus/new" element={<AdminMenuForm />} />
          <Route path="menus/:id" element={<AdminMenuForm />} />
          <Route path=":slug/*" element={<AdminFeaturePage />} />
        </Route>

        {/* 동적 기능 페이지 */}
        <Route path="/:slug/*" element={<FeaturePage />} />
      </Route>
    </Routes>
  )
}
