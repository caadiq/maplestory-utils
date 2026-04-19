import { useAuthStore } from '../stores/auth'

export async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  // 관리자 API에는 로그인 다이얼로그에서 저장한 키를 자동으로 헤더에 포함
  if (url.startsWith('/api/admin')) {
    const adminKey = useAuthStore.getState().apiKey
    if (adminKey) headers['x-admin-key'] = adminKey
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    const e = new Error(error.error || `HTTP ${res.status}`)
    Object.assign(e, error, { status: res.status })
    throw e
  }

  return res.json()
}
