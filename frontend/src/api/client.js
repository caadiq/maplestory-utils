export async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  // 관리자 API에는 인증 헤더 자동 추가
  if (url.startsWith('/api/admin')) {
    const adminKey = localStorage.getItem('maple-admin-key')
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
    throw new Error(error.error || `HTTP ${res.status}`)
  }

  return res.json()
}
