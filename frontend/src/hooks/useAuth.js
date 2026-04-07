import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setAuthenticated(false)
  }

  return { authenticated, loading, logout }
}
