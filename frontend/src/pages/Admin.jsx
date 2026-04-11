import { useState, useEffect } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { api } from '../api/client'

export default function Admin() {
  const [searchParams] = useSearchParams()
  const [verified, setVerified] = useState(null) // null=로딩, true=인증됨, false=실패

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
    return <div className="text-center text-gray-400 pt-16">인증 중...</div>
  }

  if (!verified) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">관리자</h1>
        <button
          onClick={() => { localStorage.removeItem('maple-admin-key'); setVerified(false) }}
          className="text-sm text-gray-500 hover:text-gray-300 transition"
        >
          로그아웃
        </button>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500">
        관리자 페이지 준비 중
      </div>
    </div>
  )
}
