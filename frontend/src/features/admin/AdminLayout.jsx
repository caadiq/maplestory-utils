import { useSearchParams, Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

export default function AdminLayout() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const isRoot = location.pathname === '/admin' || location.pathname === '/admin/'

  const keyFromUrl = searchParams.get('key')
  const key = keyFromUrl || localStorage.getItem('maple-admin-key')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'verify', key],
    queryFn: async () => {
      if (!key) throw new Error('no key')
      await api('/api/admin/verify', { method: 'POST', body: { key } })
      localStorage.setItem('maple-admin-key', key)
      return true
    },
    enabled: !!key,
    retry: false,
    staleTime: Infinity,
  })

  const verified = data === true

  const handleLogout = () => {
    localStorage.removeItem('maple-admin-key')
    queryClient.removeQueries({ queryKey: ['admin'] })
    window.location.href = '/'
  }

  if (key && isLoading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!verified) {
    if (key) localStorage.removeItem('maple-admin-key')
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
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-300 transition"
        >
          로그아웃
        </button>
      </div>

      <Outlet />
    </div>
  )
}
