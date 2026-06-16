import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'
import { WEEKLY_BOSSES, MONTHLY_BOSSES, DESTINY_BOSSES, todayKST } from './data'

function makeEmptyWeekly() {
  const bosses = {}
  WEEKLY_BOSSES.forEach((b) => {
    bosses[b.key] = { difficulty: 'none', party: 1, done: false }
  })
  return {
    bosses,
    blackMage: { difficulty: 'none', party: 1, done: false },
  }
}

function makeEmptyDestinyWeekly() {
  const bosses = {}
  DESTINY_BOSSES.forEach((b) => {
    bosses[b.key] = { difficulty: 'none', party: 1, done: false }
  })
  return { bosses }
}

function makeInitialSlot() {
  return {
    startChapter: 0,
    currentPoints: 0,
    startDate: dayjs(todayKST()).toISOString(),
    weekly: makeEmptyWeekly(),
    schedulerWeeks: [{ id: 1, config: makeEmptyWeekly() }],
  }
}

function makeInitialDestinySlot() {
  return {
    startChapter: 0,
    currentPoints: 0,
    startDate: dayjs(todayKST()).toISOString(),
    weekly: makeEmptyDestinyWeekly(),
    schedulerWeeks: [{ id: 1, config: makeEmptyDestinyWeekly() }],
  }
}

/**
 * 해방 계산기 상태
 * calcMode: 'simple' | 'weekly'  (제네시스/데스티니가 공유)
 * simple / weekly: 제네시스 모드별 독립 슬롯
 * destinySimple / destinyWeekly: 데스티니 모드별 독립 슬롯
 */
export const useLiberationStore = create(persist(
  (set) => ({
    liberationType: 'genesis', // 'genesis' | 'destiny'
    genesisCalcMode: 'simple',
    destinyCalcMode: 'simple',
    genesisPassOn: false, // 사용자가 제네시스 패스 보유 시 직접 켜는 토글 (제네시스 전용)
    simple: makeInitialSlot(),
    weekly: makeInitialSlot(),
    destinySimple: makeInitialDestinySlot(),
    destinyWeekly: makeInitialDestinySlot(),

    setLiberationType: (type) => set({ liberationType: type }),
    setGenesisCalcMode: (mode) => set({ genesisCalcMode: mode }),
    setDestinyCalcMode: (mode) => set({ destinyCalcMode: mode }),
    setGenesisPassOn: (on) => set({ genesisPassOn: on }),

    updateSlot: (patch) => set((s) => ({
      [s.genesisCalcMode]: typeof patch === 'function'
        ? patch(s[s.genesisCalcMode])
        : { ...s[s.genesisCalcMode], ...patch },
    })),

    resetSlot: () => set((s) => ({ [s.genesisCalcMode]: makeInitialSlot() })),

    updateDestinySlot: (patch) => set((s) => {
      const key = s.destinyCalcMode === 'weekly' ? 'destinyWeekly' : 'destinySimple'
      return {
        [key]: typeof patch === 'function' ? patch(s[key]) : { ...s[key], ...patch },
      }
    }),

    resetDestinySlot: () => set((s) => {
      const key = s.destinyCalcMode === 'weekly' ? 'destinyWeekly' : 'destinySimple'
      return { [key]: makeInitialDestinySlot() }
    }),
  }),
  {
    name: 'maple-liberation',
    version: 2,
    migrate: (persisted) => {
      if (!persisted) return persisted
      // 데스티니 슬롯에 weekly/schedulerWeeks 필드가 없으면 빈 값으로 채움
      const fill = (slot) => {
        if (!slot) return slot
        return {
          ...slot,
          weekly: slot.weekly || makeEmptyDestinyWeekly(),
          schedulerWeeks: slot.schedulerWeeks || [{ id: 1, config: makeEmptyDestinyWeekly() }],
        }
      }
      return {
        ...persisted,
        destinySimple: fill(persisted.destinySimple),
        destinyWeekly: fill(persisted.destinyWeekly),
      }
    },
  },
))

export { makeEmptyWeekly, makeEmptyDestinyWeekly, makeInitialSlot, makeInitialDestinySlot }
