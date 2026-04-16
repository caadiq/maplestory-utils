import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'
import { WEEKLY_BOSSES, MONTHLY_BOSSES, todayKST } from './data'

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

function makeInitialSlot() {
  return {
    startChapter: 0,
    currentPoints: 0,
    startDate: dayjs(todayKST()).toISOString(),
    weekly: makeEmptyWeekly(),
    schedulerWeeks: [{ id: 1, config: makeEmptyWeekly() }],
  }
}

/**
 * 해방 계산기 상태
 * calcMode: 'simple' | 'weekly'
 * simple / weekly: 각 모드 독립 슬롯
 */
export const useLiberationStore = create(persist(
  (set) => ({
    calcMode: 'simple',
    simple: makeInitialSlot(),
    weekly: makeInitialSlot(),

    setCalcMode: (mode) => set({ calcMode: mode }),

    updateSlot: (patch) => set((s) => ({
      [s.calcMode]: typeof patch === 'function'
        ? patch(s[s.calcMode])
        : { ...s[s.calcMode], ...patch },
    })),

    resetSlot: () => set((s) => ({ [s.calcMode]: makeInitialSlot() })),
  }),
  { name: 'maple-liberation' },
))

export { makeEmptyWeekly, makeInitialSlot }
