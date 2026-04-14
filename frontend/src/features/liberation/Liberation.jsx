import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api } from '../../api/client'
import {
  GENESIS_CHAPTERS,
  GENESIS_TOTAL,
  WEEKLY_BOSSES,
  MONTHLY_BOSSES,
  calcPoints,
  addWeeks,
  formatDate,
  todayKST,
} from './data'
import WeekCard from './components/WeekCard'
import QuestSelector from './components/QuestSelector'
import PointsInput from './components/PointsInput'
import ProgressBar from './components/ProgressBar'
import WeeklyDefault from './components/WeeklyDefault'
import DatePicker from '../../components/DatePicker'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useLayout } from '../../components/Layout'

const STORAGE_KEY = 'maple-liberation'

function makeEmptyWeek(startDate) {
  return {
    startDate: dayjs(startDate).toISOString(),
    ...makeEmptyWeekly(),
  }
}

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

function calcMonthlyDoneEarn(weekData) {
  return weekData.blackMage?.done ? bossEarn(MONTHLY_BOSSES[0], weekData.blackMage) : 0
}

export default function Liberation() {
  const { setFullscreen } = useLayout()
  useEffect(() => {
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

  const makeInitialSlot = () => ({
    startChapter: 0,
    currentPoints: 0,
    startDate: dayjs(todayKST()).toISOString(),
    weekly: makeEmptyWeekly(),
    weekOverrides: {},
    weeks: [makeEmptyWeek(todayKST())],
  })

  const [root, setRoot] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // 구버전(단일 slot) → 새 구조로 마이그레이션
        if (!parsed.calcMode) {
          if (!parsed.weekly) parsed.weekly = makeEmptyWeekly()
          if (!parsed.startDate) parsed.startDate = dayjs(todayKST()).toISOString()
          if (!parsed.weekOverrides) parsed.weekOverrides = {}
          return { calcMode: 'simple', simple: parsed, weekly: makeInitialSlot() }
        }
        return parsed
      } catch { /* ignore */ }
    }
    return { calcMode: 'simple', simple: makeInitialSlot(), weekly: makeInitialSlot() }
  })

  const calcMode = root.calcMode
  const state = root[calcMode]
  const setState = (updater) => {
    setRoot((prev) => ({
      ...prev,
      [prev.calcMode]: typeof updater === 'function' ? updater(prev[prev.calcMode]) : updater,
    }))
  }
  const setCalcMode = (mode) => setRoot((prev) => ({ ...prev, calcMode: mode }))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root))
  }, [root])

  // 주차별 계산
  const progressByWeek = useMemo(() => {
    const result = []
    const startConsumedBefore = GENESIS_CHAPTERS
      .slice(0, state.startChapter)
      .reduce((s, c) => s + c.required, 0)
    const currentChapterCap = GENESIS_CHAPTERS[state.startChapter]?.required ?? 0
    const clampedCurrent = Math.min(state.currentPoints, currentChapterCap)
    let totalAccumulated = startConsumedBefore + clampedCurrent

    for (const week of state.weeks) {
      const earned = calcWeekPoints(week)
      totalAccumulated += earned

      let temp = totalAccumulated
      let chapterIdx = 0
      while (chapterIdx < GENESIS_CHAPTERS.length && temp >= GENESIS_CHAPTERS[chapterIdx].required) {
        temp -= GENESIS_CHAPTERS[chapterIdx].required
        chapterIdx++
      }

      const isCompleted = totalAccumulated >= GENESIS_TOTAL
      const chapterInfo = isCompleted
        ? { name: '완료', current: GENESIS_TOTAL, required: GENESIS_TOTAL }
        : {
            name: GENESIS_CHAPTERS[chapterIdx]?.boss || '',
            current: temp,
            required: GENESIS_CHAPTERS[chapterIdx]?.required || 0,
          }

      result.push({
        points: earned,
        cumulative: totalAccumulated,
        completed: isCompleted,
        chapterInfo,
      })
    }
    return result
  }, [state])

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

  // 날짜 이벤트 시뮬레이션으로 해방일 계산
  function computeCompletionDate() {
    if (alreadyDone) return todayKST()
    if (weeklyEarn === 0 && monthlyEarn === 0) return null
    if (remaining <= 0) return dayjs(state.startDate).tz('Asia/Seoul').startOf('day').toDate()

    const startKST = dayjs(state.startDate).tz('Asia/Seoul').startOf('day')
    const events = []

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

    events.sort((a, b) => a.date.diff(b.date))
    let cumulative = 0
    for (const e of events) {
      cumulative += e.amount
      if (cumulative >= remaining) return e.date.toDate()
    }
    return null
  }

  const completionDate = computeCompletionDate()
  const isDone = completionDate !== null

  const updateWeek = (idx, newWeekData) => {
    setState((prev) => ({
      ...prev,
      weeks: prev.weeks.map((w, i) => (i === idx ? newWeekData : w)),
    }))
  }

  const addWeek = () => {
    setState((prev) => {
      const lastWeek = prev.weeks[prev.weeks.length - 1]
      const nextStart = addWeeks(lastWeek.startDate, 1)
      return {
        ...prev,
        weeks: [...prev.weeks, { ...lastWeek, startDate: dayjs(nextStart).toISOString() }],
      }
    })
  }

  const removeWeek = (idx) => {
    setState((prev) => ({ ...prev, weeks: prev.weeks.filter((_, i) => i !== idx) }))
  }

  const [resetOpen, setResetOpen] = useState(false)
  const doReset = () => {
    setState(makeInitialSlot())
    setResetOpen(false)
  }

  const setFirstWeekDate = (dateStr) => {
    setState((prev) => {
      const weeks = prev.weeks.map((w, i) => ({
        ...w,
        startDate: dayjs(addWeeks(dateStr, i)).toISOString(),
      }))
      return { ...prev, weeks }
    })
  }

  const totalCumulative = progressByWeek[progressByWeek.length - 1]?.cumulative
    || (GENESIS_CHAPTERS.slice(0, state.startChapter).reduce((s, c) => s + c.required, 0) + state.currentPoints)
  const overallProgress = Math.min((totalCumulative / GENESIS_TOTAL) * 100, 100)

  return (
    <div className="space-y-6 pb-10">
      {/* 해방 종류 탭 */}
      <div className="max-w-3xl mx-auto flex gap-2">
        {[
          { key: 'genesis', label: '제네시스 해방', img: genesisImg.data?.url },
          { key: 'destiny', label: '데스티니 해방', img: destinyImg.data?.url },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setLiberationType(tab.key)}
            className={`flex-1 flex items-center justify-center gap-3 rounded-2xl border px-5 py-3 transition ${
              liberationType === tab.key
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 shadow-lg shadow-emerald-500/10'
                : 'border-white/10 bg-gray-900/40 text-gray-400 hover:border-white/20 hover:text-gray-200'
            }`}
          >
            {tab.img && <img src={tab.img} alt="" className="w-8 h-8 object-contain" />}
            <span className="text-base font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>

      {liberationType === 'destiny' ? (
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-16 text-center space-y-3 flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 220px)' }}>
          <div className="text-2xl font-bold text-gray-300">구현 예정</div>
          <div className="text-sm text-gray-500">데스티니 해방 계산기는 준비 중입니다.</div>
        </div>
      ) : (<>
      {/* 계산 모드 탭 */}
      <div className="max-w-3xl mx-auto flex gap-1 p-1 rounded-xl border border-white/10 bg-gray-950/60">
        {[
          { key: 'simple', label: '단순 계산' },
          { key: 'weekly', label: '주차별 계산' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setCalcMode(t.key)}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition ${
              calcMode === t.key
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ProgressBar
        startChapter={state.startChapter}
        currentPoints={state.currentPoints}
        completionDate={isDone ? formatDate(completionDate) : null}
      />

      {/* 현재 진행 상태 입력 */}
      <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 space-y-4">
        <div className="text-lg font-semibold text-emerald-300">현재 진행 상태</div>

        <div className="grid gap-3" style={{ gridTemplateColumns: '1.2fr 1.2fr 0.7fr' }}>
          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400">시작 날짜</label>
            <DatePicker
              value={formatDate(state.startDate)}
              onChange={(d) => setState((prev) => ({ ...prev, startDate: dayjs(d).toISOString() }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400">진행 중인 퀘스트</label>
            <QuestSelector
              value={state.startChapter}
              onChange={(idx) => setState((prev) => ({ ...prev, startChapter: idx }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400">현재 흔적</label>
            <PointsInput
              value={state.currentPoints}
              max={3000}
              onChange={(n) => setState((prev) => ({ ...prev, currentPoints: n }))}
              className="w-full h-12 rounded-lg border border-white/10 bg-gray-950 px-3 text-base text-right tabular-nums outline-none focus:border-emerald-500/50 hover:border-white/20 transition"
            />
          </div>
        </div>
      </div>

      <WeeklyDefault
        weekly={state.weekly}
        onChange={(w) => setState((prev) => ({ ...prev, weekly: w }))}
        totalWeekly={weeklyEarn}
        totalMonthly={monthlyEarn}
        mode={calcMode}
      />

      <div className="max-w-3xl mx-auto flex justify-end">
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 px-5 py-2.5 text-sm font-semibold transition shadow-lg shadow-red-500/10"
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
