import { useState, useEffect } from 'react'
import { useSearchParams, Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { api } from '../../api/client'

export default function AdminLayout() {
  const [searchParams] = useSearchParams()
  const [verified, setVerified] = useState(null)
  const location = useLocation()
  const isRoot = location.pathname === '/admin' || location.pathname === '/admin/'

  useEffect(() => {
    const keyFromUrl = searchParams.get('key')
    const keyFromStorage = localStorage.getItem('maple-admin-key')
    const key = keyFromUrl || keyFromStorage

    if (!key) {
      setVerified(false)
      return
    }

    api('/api/admin/verify', { method: 'POST', body: { key } })
      .then(() => {
        localStorage.setItem('maple-admin-key', key)
        setVerified(true)
      })
      .catch(() => {
        localStorage.removeItem('maple-admin-key')
        setVerified(false)
      })
  }, [searchParams])

  if (verified === null) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!verified) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isRoot && (
            <Link
              to="/admin"
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-400 hover:text-white transition"
              aria-label="뒤로"
            >
              ←
            </Link>
          )}
          <div>
            <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">Admin</div>
            <h1 className="text-2xl font-bold tracking-tight">관리자</h1>
          </div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('maple-admin-key'); setVerified(false) }}
          className="text-sm text-gray-500 hover:text-gray-300 transition"
        >
          로그아웃
        </button>
      </div>

      <Outlet />
    </div>
  )
}
