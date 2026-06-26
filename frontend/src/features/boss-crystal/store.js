import { create } from 'zustand'

/**
 * 보스 수익 계산기 상태
 * characters: [{ character_name, character_image, character_level, job_name, ... }]
 * selectedChar: 선택된 캐릭터 닉네임
 * selections: { [character_name]: { [bossId]: { difficulty, party } } }
 *
 * 저장은 useFeatureSync 훅이 담당 (게스트=localStorage / 로그인=서버).
 */
export const bossInitialState = { characters: [], selectedChar: null, selections: {} }

export const useBossStore = create(
  (set) => ({
    ...bossInitialState,

    setCharacters: (next) => set((s) => ({
      characters: typeof next === 'function' ? next(s.characters) : next,
    })),

    addCharacter: (char) => set((s) => {
      if (s.characters.find((c) => c.character_name === char.character_name)) return s
      return {
        characters: [...s.characters, char],
        selectedChar: char.character_name,
      }
    }),

    removeCharacter: (name) => set((s) => {
      const next = s.characters.filter((c) => c.character_name !== name)
      const nextSel = { ...s.selections }
      delete nextSel[name]
      return {
        characters: next,
        selections: nextSel,
        selectedChar: s.selectedChar === name ? (next[0]?.character_name || null) : s.selectedChar,
      }
    }),

    selectCharacter: (name) => set({ selectedChar: name }),

    updateCharacter: (name, patch) => set((s) => ({
      characters: s.characters.map((c) => (c.character_name === name ? { ...c, ...patch } : c)),
    })),

    reorderCharacters: (next) => set({ characters: next }),

    setBossSelection: (charName, bossId, sel) => set((s) => {
      const charSel = { ...(s.selections[charName] || {}) }
      if (sel === null) delete charSel[bossId]
      else charSel[bossId] = sel
      return { selections: { ...s.selections, [charName]: charSel } }
    }),
  }),
)
