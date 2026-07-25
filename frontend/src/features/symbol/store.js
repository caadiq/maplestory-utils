import { create } from 'zustand'

/**
 * 심볼 계산기 상태
 * characters: [{ id, character_name, character_level, job_name, character_image, event_skill, ... }]
 *   - event_skill: { skill_name, skill_level, arcane_daily, authentic_daily } | null
 *   - artifact: { arcane_daily, authentic_daily } | null (에테리온 아티팩트 일퀘 보너스)
 * selectedCharId: 현재 선택된 캐릭터 id (ocid)
 * progress: {
 *   [charId]: {
 *     [symbolId]: {
 *       level: number,
 *       growth: number,          // 현재 누적 성장치
 *       daily: number,            // 일퀘 획득량 (기본값 수정 가능)
 *       weeklyCount: 1|2|3,       // 주간퀘 횟수
 *       extra: number,            // 추가 심볼
 *       dailyDone: boolean,       // 금일 일퀘 완료 여부
 *     }
 *   }
 * }
 *
 * 저장은 useFeatureSync 훅이 담당 (게스트=localStorage / 로그인=서버).
 */
export const symbolInitialState = { characters: [], selectedCharId: null, progress: {}, selectedTabs: {} }

export const useSymbolStore = create(
  (set, get) => ({
    ...symbolInitialState, // selectedTabs: { [charId]: '아케인' | '어센틱' | '그랜드 어센틱' }

    setTab: (charId, tabKey) => set((s) => ({
      selectedTabs: { ...s.selectedTabs, [charId]: tabKey },
    })),

    setCharacters: (next) => set((s) => ({
      characters: typeof next === 'function' ? next(s.characters) : next,
    })),

    addCharacter: (char) => set((s) => {
      if (s.characters.find((c) => c.character_name === char.character_name)) return s
      const entry = { ...char, id: char.ocid }
      return {
        characters: [...s.characters, entry],
        selectedCharId: entry.id,
      }
    }),

    removeCharacter: (id) => set((s) => {
      const nextProgress = { ...s.progress }
      delete nextProgress[id]
      return {
        characters: s.characters.filter((c) => c.id !== id),
        selectedCharId: s.selectedCharId === id ? null : s.selectedCharId,
        progress: nextProgress,
      }
    }),

    selectCharacter: (id) => set({ selectedCharId: id }),

    updateCharacter: (id, patch) => set((s) => ({
      characters: s.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

    getSymbolState: (charId, symbolId) => get().progress?.[charId]?.[symbolId],

    updateSymbol: (charId, symbolId, patch) => set((s) => {
      const charProg = s.progress[charId] || {}
      const symProg = charProg[symbolId] || {}
      return {
        progress: {
          ...s.progress,
          [charId]: {
            ...charProg,
            [symbolId]: { ...symProg, ...patch },
          },
        },
      }
    }),

    resetCharacter: (charId) => set((s) => {
      const next = { ...s.progress }
      delete next[charId]
      return { progress: next }
    }),

    /**
     * API 응답을 store에 반영.
     * equippedMap: { [symbolId]: { level, growth, require_growth } }
     * - API에 있는 심볼: equipped=true, level/growth 갱신 (사용자 입력값인 daily/weeklyCount/extra/dailyDone은 유지)
     * - API에 없는 심볼: equipped=false로 마킹
     */
    syncCharacterSymbols: (charId, equippedMap) => set((s) => {
      const charProg = { ...(s.progress[charId] || {}) }
      // 기존 equipped를 false로 초기화
      for (const k of Object.keys(charProg)) {
        charProg[k] = { ...charProg[k], equipped: false }
      }
      // 새 장착 정보 병합
      for (const [sid, info] of Object.entries(equippedMap)) {
        charProg[sid] = {
          ...(charProg[sid] || {}),
          equipped: true,
          level: info.level,
          growth: info.growth,
          require_growth: info.require_growth,
        }
      }
      return { progress: { ...s.progress, [charId]: charProg } }
    }),
  }),
)
