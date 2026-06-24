import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'

export default function AdminLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!user?.is_admin) return <Navigate to="/" replace />

  return <Outlet />
}
