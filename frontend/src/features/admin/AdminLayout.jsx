import { useSearchParams, Outlet, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

export default function AdminLayout() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

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

  return <Outlet context={{ handleLogout }} />
}
