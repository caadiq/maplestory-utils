import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/**
 * 현재 로그인 사용자. 서버 세션(/api/auth/me)이 단일 소스.
 * 게스트면 user=null. 로그인/로그아웃 후 ['auth','me']를 invalidate하면 갱신된다.
 * @returns {{ user: {id, nickname, is_admin}|null, isLoading: boolean }}
 */
export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api('/api/auth/me').then((r) => r.user).catch(() => null),
    staleTime: Infinity,
  })
  return { user: data ?? null, isLoading }
}
