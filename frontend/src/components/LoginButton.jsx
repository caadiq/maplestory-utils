import { useAuth } from '../hooks/useAuth'

export default function LoginButton() {
  const { authenticated, loading, logout } = useAuth()

  if (loading) return null

  if (authenticated) {
    return (
      <button
        onClick={logout}
        className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600 transition"
      >
        로그아웃
      </button>
    )
  }

  return (
    <a
      href="/api/auth/login"
      className="rounded bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 transition"
    >
      넥슨 로그인
    </a>
  )
}
