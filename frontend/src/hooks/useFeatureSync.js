import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { api } from '../api/client'

// store 상태에서 데이터 필드만 추출 (액션 함수 제외)
function pickData(state) {
  const out = {}
  for (const [k, v] of Object.entries(state)) {
    if (typeof v !== 'function') out[k] = v
  }
  return out
}

function debounce(fn, ms) {
  let t = null
  let lastArgs
  const d = (...a) => { lastArgs = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...lastArgs) }, ms) }
  d.flush = () => { if (t) { clearTimeout(t); t = null; fn(...lastArgs) } }
  return d
}

/**
 * feature 계산기 상태를 게스트(localStorage)/로그인(서버)으로 동기화.
 * - 게스트와 로그인 계정은 분리된 공간: 로그인하면 계정 값을 보고(로컬 보존),
 *   로그아웃하면 게스트 로컬 값으로 돌아온다.
 * - 첫 로그인 시 계정이 비어 있으면 게스트 로컬 데이터를 1회 이관한다.
 *
 * @param {string} feature - 'boss-crystal' | 'symbol' | 'liberation'
 * @param {object} store   - zustand store (getState/setState/subscribe)
 * @param {object} initial - 데이터 필드 초기값
 */
export function useFeatureSync({ feature, store, initial }) {
  const { user, isLoading } = useAuth()
  const localKey = `maple-${feature}`
  const hydrating = useRef(true)

  // 로드: user 전환 시 소스에서 store 채우기
  useEffect(() => {
    if (isLoading) return
    let cancelled = false
    hydrating.current = true

    const apply = (data) => {
      if (cancelled) return
      store.setState({ ...initial, ...(data || {}) })
      setTimeout(() => { if (!cancelled) hydrating.current = false }, 0)
    }
    const readGuest = () => {
      try { const raw = localStorage.getItem(localKey); return raw ? JSON.parse(raw) : null } catch { return null }
    }

    if (user) {
      api(`/api/me/state/${feature}`).then((r) => {
        if (cancelled) return
        if (r.payload) { apply(r.payload); return }
        // 계정 비어 있음 → 게스트 데이터 1회 이관
        const guest = readGuest()
        if (guest) {
          apply(guest)
          api(`/api/me/state/${feature}`, { method: 'PUT', body: { payload: guest } }).catch(() => {})
        } else {
          apply(initial)
        }
      }).catch(() => apply(initial))
    } else {
      apply(readGuest() || initial)
    }

    return () => { cancelled = true }
  }, [user, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // 저장: store 변경 → 소스에 저장 (hydrate로 인한 변경은 무시)
  useEffect(() => {
    if (isLoading) return
    const save = debounce((state) => {
      if (hydrating.current) return
      const data = pickData(state)
      if (user) {
        api(`/api/me/state/${feature}`, { method: 'PUT', body: { payload: data } }).catch(() => {})
      } else {
        try { localStorage.setItem(localKey, JSON.stringify(data)) } catch { /* 저장 실패 무시 */ }
      }
    }, 300)
    const unsub = store.subscribe((s) => save(s))
    return () => { unsub(); save.flush() }
  }, [user, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps
}
