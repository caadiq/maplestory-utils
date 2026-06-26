import { create } from 'zustand'
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
 * 해방 계산기 초기 상태 (startDate가 오늘 기준이라 매번 생성)
 */
export function liberationInitial() {
  return {
    liberationType: 'genesis', // 'genesis' | 'destiny'
    genesisCalcMode: 'simple',
    destinyCalcMode: 'simple',
    genesisPassOn: false, // 사용자가 제네시스 패스 보유 시 직접 켜는 토글 (제네시스 전용)
    simple: makeInitialSlot(),
    weekly: makeInitialSlot(),
    destinySimple: makeInitialDestinySlot(),
    destinyWeekly: makeInitialDestinySlot(),
  }
}

/**
 * 로드한 데이터 구조 보강: 데스티니 슬롯에 weekly/schedulerWeeks가 없으면 채움
 * (기존 persist version 2 migrate를 대체)
 */
export function migrateLiberationState(data) {
  if (!data) return data
  const fillDestiny = (slot) => (slot ? {
    ...slot,
    weekly: slot.weekly || makeEmptyDestinyWeekly(),
    schedulerWeeks: slot.schedulerWeeks || [{ id: 1, config: makeEmptyDestinyWeekly() }],
  } : slot)
  return {
    ...data,
    destinySimple: fillDestiny(data.destinySimple),
    destinyWeekly: fillDestiny(data.destinyWeekly),
  }
}

/**
 * 해방 계산기 상태
 * calcMode: 'simple' | 'weekly'  (제네시스/데스티니가 공유)
 * simple / weekly: 제네시스 모드별 독립 슬롯
 * destinySimple / destinyWeekly: 데스티니 모드별 독립 슬롯
 *
 * 저장은 useFeatureSync 훅이 담당 (게스트=localStorage / 로그인=서버).
 */
export const useLiberationStore = create(
  (set) => ({
    ...liberationInitial(),

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
)

export { makeEmptyWeekly, makeEmptyDestinyWeekly, makeInitialSlot, makeInitialDestinySlot }
