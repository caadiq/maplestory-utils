import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import FeaturePage from './features/FeaturePage'
import AdminLayout from './features/admin/AdminLayout'
import AdminHome from './features/admin/AdminHome'
import AdminImages from './features/admin/AdminImages'
import AdminMenuForm from './features/admin/AdminMenuForm'
import AdminFeaturePage from './features/admin/AdminFeaturePage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />

        {/* 관리자 */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="images" element={<AdminImages />} />
          <Route path="menus/new" element={<AdminMenuForm />} />
          <Route path="menus/:id" element={<AdminMenuForm />} />
          <Route path=":slug" element={<AdminFeaturePage />} />
        </Route>

        {/* 동적 기능 페이지 */}
        <Route path="/:slug" element={<FeaturePage />} />
      </Route>
    </Routes>
  )
}
