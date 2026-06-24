import { Outlet, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuthStore } from '../../../stores/auth'

export default function AdminLayout() {
  const queryClient = useQueryClient()
  const apiKey = useAuthStore((s) => s.apiKey)
  const clearApiKey = useAuthStore((s) => s.clearApiKey)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'verify'],
    queryFn: async () => {
      // client.js가 /api/admin 요청에 x-admin-key 헤더를 자동 첨부
      // (키 평문을 queryKey/body에 노출하지 않음). 키 변경 시 LoginDialog가 invalidate.
      await api('/api/admin/verify', { method: 'POST' })
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
