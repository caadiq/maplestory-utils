import { api } from '../../api/client'
import { DEFAULT_SETTINGS } from './logic'

/**
 * 캐릭터 프로필 저장소.
 *
 * 로그인했으면 서버(user_states의 'timer')에, 아니면 localStorage에 둔다.
 * 서버에 두는 이유는 **다른 PC·브라우저에서도 같은 캐릭터면 같은 설정이 따라오게** 하려는 것 —
 * 그게 이 기능의 목적이라 로컬에만 두면 반쪽이다.
 *
 * 다른 계산기들은 zustand + useFeatureSync를 쓰지만 타이머 설정은 useState라
 * 여기서는 같은 API만 직접 부른다 (스토어를 새로 만들 만큼 상태가 크지 않다).
 */

const LOCAL_KEY = 'maple.janus.profiles'
const FEATURE = 'timer'

/** 프로필에 담는 설정 — 알림 스위치와 소리류 전부. 캐릭터마다 다를 수 있는 것들이다 */
export const PROFILE_KEYS = Object.keys(DEFAULT_SETTINGS)

/** 설정에서 프로필에 저장할 부분만 뽑는다 */
export function snapshot(settings) {
  const out = {}
  for (const k of PROFILE_KEYS) if (k in settings) out[k] = settings[k]
  return out
}

let seq = 0
export function newId() {
  seq += 1
  return `p${Date.now().toString(36)}${seq.toString(36)}`
}

/** 저장된 모양이 지금 코드와 맞는지 — 낡거나 깨진 것은 버린다 */
function valid(p) {
  return p
    && typeof p.id === 'string'
    && Array.isArray(p.patch) && p.patch.length > 0
    && Number.isFinite(p.pw) && p.pw >= 6
    && Number.isFinite(p.ph) && p.ph >= 4
    && p.patch.length === p.pw * p.ph
    && Number.isFinite(p.scale) && p.scale > 0
    && p.settings && typeof p.settings === 'object'
}

/** 저장본을 감지에 쓸 수 있는 모양으로 (patch를 Float32Array로) */
export function toRuntime(list) {
  return list.map((p) => ({ ...p, patch: Float32Array.from(p.patch) }))
}

const readLocal = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter(valid) : []
  } catch {
    return []
  }
}

const writeLocal = (list) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  } catch {
    // 용량 초과 — 조각이 커봐야 프로필당 수 KB라 실제로는 거의 안 난다
  }
}

/**
 * 불러오기. 로그인 상태면 서버를 보고, 서버가 비어 있으면 로컬 것을 1회 옮긴다
 * (다른 계산기들과 같은 방식 — useFeatureSync 참고).
 */
export async function loadProfiles(user) {
  if (!user) return readLocal()
  try {
    const r = await api(`/api/me/state/${FEATURE}`)
    const list = Array.isArray(r?.payload?.profiles) ? r.payload.profiles.filter(valid) : null
    if (list && list.length) return list
    const guest = readLocal()
    if (guest.length) {
      await api(`/api/me/state/${FEATURE}`, { method: 'PUT', body: { payload: { profiles: guest } } })
      return guest
    }
    return []
  } catch {
    return readLocal()   // 서버가 안 되면 로컬이라도
  }
}

export async function saveProfiles(user, list) {
  const clean = list.filter(valid)
  writeLocal(clean)      // 로그인해도 로컬에 남겨 둔다 — 로그아웃해도 안 잃게
  if (!user) return
  try {
    await api(`/api/me/state/${FEATURE}`, { method: 'PUT', body: { payload: { profiles: clean } } })
  } catch {
    // 서버 저장 실패는 조용히 넘긴다 — 로컬에는 이미 들어갔다
  }
}
