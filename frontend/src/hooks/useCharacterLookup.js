import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../api/client'

/**
 * 선택 캐릭터 상세 재조회 — localStorage 캐시로 새로고침 직후 깜빡임을 없앤다.
 *
 * 넥슨 데이터는 전일 기준이라 추가 시점 스냅샷으로 두면 굳는다. 마지막 응답을
 * 로컬에 캐시해 즉시 그리고, 뒤에서 조용히 최신화한다. (exp·hexa 공통 패턴)
 *
 * 응답 후처리(캐릭터 목록 최신화 등)는 기능마다 달라 호출부가 결과로 처리한다.
 *
 * @param queryKey react-query 키
 * @param cacheKey localStorage 키
 * @param endpoint 조회 URL
 * @param enabled  조회 활성 조건
 */
export function useCharacterLookup({ queryKey, cacheKey, endpoint, enabled }) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api(endpoint)
      try { localStorage.setItem(cacheKey, JSON.stringify(res)) } catch { /* 저장 실패 무시 */ }
      return res
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
    initialData: () => {
      try { return JSON.parse(localStorage.getItem(cacheKey)) || undefined } catch { return undefined }
    },
    initialDataUpdatedAt: 0,
  })
}
