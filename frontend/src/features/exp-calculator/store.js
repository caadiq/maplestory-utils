import { create } from 'zustand'
import { defaultSettings } from './logic'

/**
 * 경험치 계산기 상태.
 * characters: [{ id(ocid), character_name, world_name, world_icon, job_name,
 *                character_level, character_image, exp_rate, artifact_exp }]
 * selectedName: 선택된 캐릭터 닉네임
 * settings: { [ocid]: 캐릭터별 입력값 (logic.defaultSettings) }
 *
 * 저장은 useFeatureSync 담당 — 게스트 localStorage / 로그인 서버(user_states).
 */
export const expInitialState = {
  characters: [],
  selectedName: null,
  settings: {},
}

export const useExpStore = create((set) => ({
  ...expInitialState,

  addCharacter: (char) => set((s) => {
    const entry = { ...char, id: char.ocid }
    const rest = s.characters.filter((c) => c.character_name !== entry.character_name)
    return {
      characters: [...rest, entry],
      selectedName: entry.character_name,
      settings: s.settings[entry.id]
        ? s.settings
        : { ...s.settings, [entry.id]: defaultSettings(entry.character_level) },
    }
  }),

  removeCharacter: (name) => set((s) => {
    const gone = s.characters.find((c) => c.character_name === name)
    const rest = s.characters.filter((c) => c.character_name !== name)
    const settings = { ...s.settings }
    if (gone) delete settings[gone.id]
    return {
      characters: rest,
      selectedName: s.selectedName === name ? (rest[0]?.character_name ?? null) : s.selectedName,
      settings,
    }
  }),

  setCharacters: (next) => set((s) => ({
    characters: typeof next === 'function' ? next(s.characters) : next,
  })),

  selectCharacter: (name) => set({ selectedName: name }),

  /** 선택 캐릭터 설정 부분 갱신 — patch(prev) 또는 객체 */
  patchSettings: (ocid, patch) => set((s) => {
    const prev = s.settings[ocid] || defaultSettings(0)
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    return { settings: { ...s.settings, [ocid]: next } }
  }),
}))
