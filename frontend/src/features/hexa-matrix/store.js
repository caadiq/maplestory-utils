import { create } from 'zustand'
import { DEFAULT_SETTINGS } from './logic'

/**
 * 헥사 계산기 상태.
 * characters: [{ id(ocid), character_name, character_level, job_name, character_image, world_icon }]
 * selectedName: 선택된 캐릭터 닉네임
 * settings: 수급 입력값 (logic.DEFAULT_SETTINGS)
 *
 * 저장은 useFeatureSync가 담당 — 게스트는 localStorage, 로그인은 서버(user_states)라
 * PC에서 추가한 캐릭터가 폰에서도 보인다.
 */
export const hexaInitialState = {
  characters: [],
  selectedName: null,
  settings: { ...DEFAULT_SETTINGS },
}

export const useHexaStore = create((set) => ({
  ...hexaInitialState,

  addCharacter: (char) => set((s) => {
    const entry = { ...char, id: char.ocid }
    const rest = s.characters.filter((c) => c.character_name !== entry.character_name)
    return { characters: [...rest, entry], selectedName: entry.character_name }
  }),

  removeCharacter: (name) => set((s) => {
    const rest = s.characters.filter((c) => c.character_name !== name)
    return {
      characters: rest,
      selectedName: s.selectedName === name ? (rest[0]?.character_name ?? null) : s.selectedName,
    }
  }),

  setCharacters: (next) => set((s) => ({
    characters: typeof next === 'function' ? next(s.characters) : next,
  })),

  selectCharacter: (name) => set({ selectedName: name }),

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
}))

/**
 * 서버 도입 전(로컬 전용 시절) 키에서 1회 이관.
 * useFeatureSync의 initial로 넘겨 게스트 local이 비어 있을 때 승계된다.
 */
export function hexaInitial() {
  try {
    const chars = JSON.parse(localStorage.getItem('maple.hexa.characters')) || []
    const settings = JSON.parse(localStorage.getItem('maple.hexa.settings.v2')) || {}
    return {
      ...hexaInitialState,
      characters: chars.map((c) => ({ ...c, id: c.id || c.ocid })),
      selectedName: chars[0]?.character_name ?? null,
      settings: { ...DEFAULT_SETTINGS, ...settings },
    }
  } catch {
    return { ...hexaInitialState }
  }
}
