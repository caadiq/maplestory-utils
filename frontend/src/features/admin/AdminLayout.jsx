import { Outlet, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'

export default function AdminLayout() {
  const queryClient = useQueryClient()
  const apiKey = useAuthStore((s) => s.apiKey)
  const clearApiKey = useAuthStore((s) => s.clearApiKey)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'verify', apiKey],
    queryFn: async () => {
      await api('/api/admin/verify', { method: 'POST', body: { key: apiKey } })
      return true
    },
    enabled: !!apiKey,
    retry: false,
    staleTime: Infinity,
  })

  const verified = data === true

  const handleLogout = () => {
    clearApiKey()
    queryClient.removeQueries({ queryKey: ['admin'] })
    window.location.href = '/'
  }

  if (apiKey && isLoading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!verified) return <Navigate to="/" replace />

  return <Outlet context={{ handleLogout }} />
}
