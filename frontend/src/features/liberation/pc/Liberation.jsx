import { useState, useEffect, useLayoutEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api } from '../../../api/client'
import {
  GENESIS_CHAPTERS,
  GENESIS_TOTAL,
  WEEKLY_BOSSES,
  MONTHLY_BOSSES,
  calcPoints,
  formatDate,
  todayKST,
} from '../data'
import { useLiberationStore } from '../store'
import QuestSelector from './components/QuestSelector'
import PointsInput from './components/PointsInput'
import ProgressBar from './components/ProgressBar'
import WeeklyDefault from './components/WeeklyDefault'
import DatePicker from '../../../components/common/DatePicker'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { useLayout } from '../../../components/pc/Layout'

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

function bossEarn(boss, sel) {
  if (!sel) return 0
  const d = boss.difficulties.find((x) => x.key === sel.difficulty)
  if (!d) return 0
  return calcPoints(d.points, sel.party)
}

function calcWeekPoints(weekData) {
  let points = 0
  WEEKLY_BOSSES.forEach((b) => {
    points += bossEarn(b, weekData.bosses[b.key])
  })
  return points
}

function calcDoneEarn(weekData) {
  let points = 0
  WEEKLY_BOSSES.forEach((b) => {
    const sel = weekData.bosses[b.key]
    if (sel?.done) points += bossEarn(b, sel)
  })
  return points
}

function calcMonthlyEarn(weekData) {
  return bossEarn(MONTHLY_BOSSES[0], weekData.blackMage)
}


export default function Liberation() {
  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  const [liberationType, setLiberationType] = useState('genesis') // 'genesis' | 'destiny'

  const genesisImg = useQuery({
    queryKey: ['image', '제네시스 스태프'],
    queryFn: () => api('/api/images/' + encodeURIComponent('제네시스 스태프')).catch(() => null),
    staleTime: Infinity,
  })
  const destinyImg = useQuery({
    queryKey: ['image', '데스티니 스태프'],
    queryFn: () => api('/api/images/' + encodeURIComponent('데스티니 스태프')).catch(() => null),
    staleTime: Infinity,
  })

  const calcMode = useLiberationStore((s) => s.calcMode)
  const state = useLiberationStore((s) => s[s.calcMode])
  const setCalcMode = useLiberationStore((s) => s.setCalcMode)
  const updateSlot = useLiberationStore((s) => s.updateSlot)
  const resetSlot = useLiberationStore((s) => s.resetSlot)
  const setState = (updater) => updateSlot(updater)

  // 포인트 이월 계산: 현재 퀘스트의 required를 초과하면 자동으로 다음 퀘스트로 넘어감
  const priorConsumed = GENESIS_CHAPTERS
    .slice(0, state.startChapter)
    .reduce((s, c) => s + c.required, 0)
  let cascadeIdx = state.startChapter
  let cascadeRemain = state.currentPoints
  let cascadeConsumed = 0
  while (cascadeIdx < GENESIS_CHAPTERS.length && cascadeRemain >= GENESIS_CHAPTERS[cascadeIdx].required) {
    cascadeConsumed += GENESIS_CHAPTERS[cascadeIdx].required
    cascadeRemain -= GENESIS_CHAPTERS[cascadeIdx].required
    cascadeIdx++
  }
  const initialAccumulated = priorConsumed + cascadeConsumed + cascadeRemain
  const alreadyDone = initialAccumulated >= GENESIS_TOTAL
  const weeklyEarn = calcWeekPoints(state.weekly)
  const remaining = Math.max(GENESIS_TOTAL - initialAccumulated, 0)
  // 주간/월간 분리
  const doneEarn = calcDoneEarn(state.weekly)
  const monthlyEarn = calcMonthlyEarn(state.weekly)
  const monthlyDoneThisMonth = !!state.weekly.blackMage?.done

  // 주차별 모드에서는 모든 주차 합산 (검은 마법사는 월별 슬롯 1회만 카운트)
  const headerWeekly = calcMode === 'weekly'
    ? (state.schedulerWeeks || []).reduce((s, w) => s + calcWeekPoints(w.config), 0)
    : weeklyEarn
  const headerMonthly = (() => {
    if (calcMode !== 'weekly') return monthlyEarn
    const sw = state.schedulerWeeks || []
    if (!state.startDate) return 0
    const claimed = {}
    sw.forEach((w, idx) => {
      const diff = w.config.blackMage?.difficulty
      if (!diff || diff === 'none') return
      const r = (() => {
        const start = dayjs(state.startDate).tz('Asia/Seoul').startOf('day')
        const dow = start.day()
        const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
        const nextThu = start.add(daysToNextThu, 'day')
        if (idx + 1 === 1) return { start, end: nextThu.subtract(1, 'day') }
        const ws = nextThu.add((idx + 1 - 2) * 7, 'day')
        return { start: ws, end: ws.add(6, 'day') }
      })()
      const months = [r.start.format('YYYY-MM'), r.end.format('YYYY-MM')]
      for (const m of months) {
        if (!(m in claimed)) {
          claimed[m] = bossEarn(MONTHLY_BOSSES[0], w.config.blackMage)
          return
        }
      }
    })
    return Object.values(claimed).reduce((s, v) => s + v, 0)
  })()

  // 날짜 이벤트 시뮬레이션으로 해방일 계산
  function computeCompletionDate() {
    if (alreadyDone) return todayKST()
    if (remaining <= 0) return dayjs(state.startDate).tz('Asia/Seoul').startOf('day').toDate()

    const startKST = dayjs(state.startDate).tz('Asia/Seoul').startOf('day')
    const events = []

    if (calcMode === 'weekly') {
      // 주차별 모드: 각 주차의 설정에 따라 적립
      const sw = state.schedulerWeeks || []
      if (sw.length === 0) return null
      // 주간 보스: 시작일 당일 = 1주차 설정, 이후 매 목요일 = 2주차/3주차 설정
      const dow = startKST.day()
      const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
      // 1주차: 시작일 당일에 (주간 - done) 적립
      const week1Cfg = sw[0]?.config || makeEmptyWeekly()
      const w1Weekly = calcWeekPoints(week1Cfg)
      const w1Done = calcDoneEarn(week1Cfg)
      events.push({ date: startKST, amount: Math.max(w1Weekly - w1Done, 0) })
      // 2주차 이후: 각 목요일에 해당 주차 설정의 주간 합 적립
      // 마지막 주차 이후로는 마지막 주차 설정을 반복 적용
      let nextThu = startKST.add(daysToNextThu, 'day')
      for (let i = 1; i < 520; i++) {
        const cfg = sw[i]?.config || sw[sw.length - 1]?.config || makeEmptyWeekly()
        events.push({ date: nextThu, amount: calcWeekPoints(cfg) })
        nextThu = nextThu.add(1, 'week')
      }

      // 검은 마법사: 슬롯 배정에 따라 해당 주차의 첫날(or 1주차이면 시작일)에 적립
      const claimed = {} // monthKey -> { weekIdx, earn, doneAlready }
      sw.forEach((w, i) => {
        const diff = w.config.blackMage?.difficulty
        if (!diff || diff === 'none') return
        const range = getSchedulerWeekRange(state.startDate, i + 1)
        const months = [range.start.format('YYYY-MM'), range.end.format('YYYY-MM')]
        for (const m of months) {
          if (!(m in claimed)) {
            claimed[m] = {
              weekIdx: i,
              earn: bossEarn(MONTHLY_BOSSES[0], w.config.blackMage),
              done: !!w.config.blackMage.done,
            }
            return
          }
        }
      })
      Object.entries(claimed).forEach(([, info]) => {
        if (info.done) return
        const wIdx = info.weekIdx
        // 1주차면 시작일, 그 외엔 해당 주차의 시작 목요일
        const date = wIdx === 0
          ? startKST
          : startKST.add(daysToNextThu + (wIdx - 1) * 7, 'day')
        events.push({ date, amount: info.earn })
      })

      // 마지막 주차 이후로는 마지막 주차의 검은 마법사 설정을 매월 반복 적용
      const lastCfg = sw[sw.length - 1]?.config
      const lastBmEarn = lastCfg ? bossEarn(MONTHLY_BOSSES[0], lastCfg.blackMage) : 0
      if (lastBmEarn > 0) {
        const lastWeekStart = sw.length === 1
          ? startKST
          : startKST.add(daysToNextThu + (sw.length - 2) * 7, 'day')
        const claimedMonths = new Set(Object.keys(claimed))
        let cursor = lastWeekStart.add(1, 'month').startOf('month')
        for (let i = 0; i < 120; i++) {
          const m = cursor.format('YYYY-MM')
          if (!claimedMonths.has(m)) {
            events.push({ date: cursor, amount: lastBmEarn })
          }
          cursor = cursor.add(1, 'month')
        }
      }
    } else {
      // 단순 계산 모드: 매주 동일 설정
      if (weeklyEarn === 0 && monthlyEarn === 0) return null

      // 시작일 당일: (주간 - 완료된 주간) + (이번 달 월간, 아직 안 잡았을 때)
      const day0Weekly = Math.max(weeklyEarn - doneEarn, 0)
      const day0Monthly = monthlyEarn > 0 && !monthlyDoneThisMonth ? monthlyEarn : 0
      events.push({ date: startKST, amount: day0Weekly + day0Monthly })

      // 다음 목요일부터 매주 주간 적립
      const dow = startKST.day()
      const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
      let nextThu = startKST.add(daysToNextThu, 'day')
      for (let i = 0; i < 520; i++) {
        events.push({ date: nextThu, amount: weeklyEarn })
        nextThu = nextThu.add(1, 'week')
      }

      // 다음 달 1일부터 매월 월간 적립
      if (monthlyEarn > 0) {
        let nextMonth = startKST.add(1, 'month').startOf('month')
        for (let i = 0; i < 120; i++) {
          events.push({ date: nextMonth, amount: monthlyEarn })
          nextMonth = nextMonth.add(1, 'month')
        }
      }
    }

    events.sort((a, b) => a.date.diff(b.date))
    let cumulative = 0
    for (const e of events) {
      cumulative += e.amount
      if (cumulative >= remaining) return e.date.toDate()
    }
    return null
  }

  function getSchedulerWeekRange(startDateStr, weekIdx) {
    const start = dayjs(startDateStr).tz('Asia/Seoul').startOf('day')
    const dow = start.day()
    const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
    const nextThu = start.add(daysToNextThu, 'day')
    if (weekIdx === 1) return { start, end: nextThu.subtract(1, 'day') }
    const ws = nextThu.add((weekIdx - 2) * 7, 'day')
    return { start: ws, end: ws.add(6, 'day') }
  }

  const completionDate = computeCompletionDate()
  const isDone = completionDate !== null

  const [resetOpen, setResetOpen] = useState(false)
  const doReset = () => {
    resetSlot()
    setResetOpen(false)
  }

  return (
    <div className="space-y-6 pb-10">
      {/* 해방 종류 탭 */}
      <div className="max-w-3xl mx-auto flex gap-2">
        {[
          { key: 'genesis', label: '제네시스 해방', img: genesisImg.data?.url },
          { key: 'destiny', label: '데스티니 해방', img: destinyImg.data?.url },
        ].map((tab) => {
          const active = liberationType === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setLiberationType(tab.key)}
              className="flex-1 flex items-center justify-center gap-3 rounded-2xl border px-5 py-3"
              style={active ? {
                background: 'var(--selected-bg)',
                borderColor: 'var(--selected-border)',
                color: 'var(--accent-bright)',
                boxShadow: 'var(--btn-primary-shadow)',
              } : {
                background: 'var(--panel-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
            >
              {tab.img && <img src={tab.img} alt="" className="w-8 h-8 object-contain" />}
              <span className="text-base font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {liberationType === 'destiny' ? (
        <div
          className="max-w-3xl mx-auto rounded-2xl border p-16 text-center space-y-3 flex flex-col items-center justify-center"
          style={{
            minHeight: 'calc(100vh - 220px)',
            background: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            boxShadow: 'var(--panel-shadow)',
          }}
        >
          <div className="text-2xl font-bold" style={{ color: 'var(--text-emphasis)' }}>구현 예정</div>
          <div className="text-sm" style={{ color: 'var(--text-dim)' }}>데스티니 해방 계산기는 준비 중입니다.</div>
        </div>
      ) : (<>
      {/* 계산 모드 탭 */}
      <div
        className="max-w-3xl mx-auto flex gap-1 p-1 rounded-xl border"
        style={{
          background: 'var(--surface-3)',
          borderColor: 'var(--panel-border)',
        }}
      >
        {[
          { key: 'simple', label: '단순 계산' },
          { key: 'weekly', label: '주차별 계산' },
        ].map((t) => {
          const active = calcMode === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setCalcMode(t.key)}
              className="flex-1 h-10 rounded-lg text-sm font-semibold"
              style={active ? {
                background: 'var(--selected-bg)',
                color: 'var(--accent-bright)',
              } : {
                color: 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <ProgressBar
        startChapter={state.startChapter}
        currentPoints={state.currentPoints}
        completionDate={isDone ? formatDate(completionDate) : null}
      />

      {/* 현재 진행 상태 입력 */}
      <div
        className="max-w-3xl mx-auto rounded-2xl border p-6 space-y-4"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <div className="text-lg font-semibold" style={{ color: 'var(--accent-bright)' }}>현재 진행 상태</div>

        <div className="grid gap-3 grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>시작 날짜</label>
            <DatePicker
              value={formatDate(state.startDate)}
              onChange={(d) => setState((prev) => ({ ...prev, startDate: dayjs(d).toISOString() }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>진행 중인 퀘스트</label>
            <QuestSelector
              value={state.startChapter}
              onChange={(idx) => setState((prev) => ({ ...prev, startChapter: idx }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>현재 흔적</label>
            <div
              className="flex items-stretch rounded-lg border focus-within:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
              }}
            >
              <PointsInput
                value={state.currentPoints}
                max={3000}
                onChange={(n) => setState((prev) => ({ ...prev, currentPoints: n }))}
                className="flex-1 min-w-0 bg-transparent px-3 h-12 text-base text-right tabular-nums outline-none"
                style={{ color: 'var(--text-strong)' }}
              />
              <span
                className="flex items-center px-3 text-base border-l select-none tabular-nums"
                style={{
                  borderColor: 'var(--input-border)',
                  color: 'var(--text-dim)',
                }}
              >
                / {(GENESIS_CHAPTERS[state.startChapter]?.required ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <WeeklyDefault
        weekly={state.weekly}
        onChange={(w) => setState((prev) => ({ ...prev, weekly: w }))}
        totalWeekly={headerWeekly}
        totalMonthly={headerMonthly}
        remaining={remaining}
        mode={calcMode}
        startDate={state.startDate}
        weeks={state.schedulerWeeks}
        onChangeWeeks={(w) => setState((prev) => ({ ...prev, schedulerWeeks: w }))}
      />

      <div className="max-w-3xl mx-auto flex justify-end">
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-[var(--danger-bg-hover)]"
          style={{
            borderColor: 'var(--icon-danger-border)',
            background: 'var(--icon-danger-bg)',
            color: 'var(--danger-text)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3H14M6 3V2C6 1.45 6.45 1 7 1H9C9.55 1 10 1.45 10 2V3M3 3L4 14C4 14.55 4.45 15 5 15H11C11.55 15 12 14.55 12 14L13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          전체 초기화
        </button>
      </div>
      </>)}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={doReset}
        title="전체 초기화"
        description={`${calcMode === 'simple' ? '단순 계산' : '주차별 계산'} 모드의 입력을 모두 초기화하시겠습니까?\n\n시작 날짜, 현재 진행 상태, 주간 보스 설정이 모두 초기값으로 되돌아갑니다.\n다른 모드의 값은 유지됩니다.`}
        confirmText="초기화"
        destructive
      />
    </div>
  )
}
