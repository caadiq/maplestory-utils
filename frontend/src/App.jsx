import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AdminLayout from './features/admin/AdminLayout'
import AdminHome from './features/admin/AdminHome'
import AdminImages from './features/admin/AdminImages'
import AdminMenuForm from './features/admin/AdminMenuForm'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="images" element={<AdminImages />} />
          <Route path="menus/new" element={<AdminMenuForm />} />
        </Route>
      </Route>
    </Routes>
  )
}
