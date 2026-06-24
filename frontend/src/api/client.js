export async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  const res = await fetch(url, {
    credentials: 'include', // 세션 쿠키(sid) 동봉
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
