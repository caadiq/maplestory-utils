import { useState, useMemo, useEffect } from 'react'
import dayjs from 'dayjs'
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
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (!parsed.weekly) parsed.weekly = makeEmptyWeekly()
        if (!parsed.startDate) parsed.startDate = dayjs(todayKST()).toISOString()
        // enabled/'none' 필드 제거 마이그레이션
        const migrate = (sel, defaultDiff) => {
          if (!sel) return sel
          if (!sel.difficulty || sel.difficulty === 'none') sel.difficulty = defaultDiff
          delete sel.enabled
          return sel
        }
        WEEKLY_BOSSES.forEach((b) => {
          if (parsed.weekly.bosses?.[b.key]) {
            parsed.weekly.bosses[b.key] = migrate(parsed.weekly.bosses[b.key], b.difficulties[0].key)
          }
        })
        parsed.weekly.blackMage = migrate(parsed.weekly.blackMage, MONTHLY_BOSSES[0].difficulties[0].key)
        return parsed
      } catch { /* ignore */ }
    }
    return {
      startChapter: 0,
      currentPoints: 0,
      startDate: dayjs(todayKST()).toISOString(),
      weekly: makeEmptyWeekly(),
      weeks: [makeEmptyWeek(todayKST())],
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

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

  const currentChapterCap = GENESIS_CHAPTERS[state.startChapter]?.required ?? 0
  const currentChapterFilled = Math.min(state.currentPoints, currentChapterCap)
  const initialAccumulated = GENESIS_CHAPTERS
    .slice(0, state.startChapter)
    .reduce((s, c) => s + c.required, 0) + currentChapterFilled
  const alreadyDone = initialAccumulated >= GENESIS_TOTAL
  const weeklyEarn = calcWeekPoints(state.weekly)
  const remaining = Math.max(GENESIS_TOTAL - initialAccumulated, 0)
  // 주간/월간 분리 계산
  const doneEarn = calcDoneEarn(state.weekly)
  const monthlyEarn = calcMonthlyEarn(state.weekly)
  const monthlyDoneEarn = calcMonthlyDoneEarn(state.weekly)

  function monthResetsBetween(start, end) {
    let count = 0
    let cursor = start.add(1, 'month').startOf('month')
    while (!cursor.isAfter(end)) {
      count++
      cursor = cursor.add(1, 'month').startOf('month')
    }
    return count
  }

  const startKST = dayjs(state.startDate).tz('Asia/Seoul')
  const currentMonthBMAvailable = monthlyEarn > 0 && monthlyDoneEarn === 0 ? monthlyEarn : 0
  const adjustedRemaining = remaining + doneEarn + monthlyDoneEarn
  let weeksNeeded = null
  if (!alreadyDone && (weeklyEarn > 0 || monthlyEarn > 0)) {
    for (let N = 1; N <= 520; N++) {
      const weeklyCum = N * weeklyEarn
      const endKST = startKST.add(N, 'week')
      const monthlyCum = currentMonthBMAvailable + monthResetsBetween(startKST, endKST) * monthlyEarn
      if (weeklyCum + monthlyCum >= adjustedRemaining) {
        weeksNeeded = N
        break
      }
    }
  }

  // 시작 날짜 기준 다음(또는 당일) 목요일
  const startDay = dayjs(state.startDate).tz('Asia/Seoul')
  const dow = startDay.day() // 0=일 ... 4=목
  const daysToThu = dow <= 4 ? 4 - dow : 11 - dow
  const upcomingThursday = startDay.add(daysToThu, 'day').startOf('day')

  const isDone = alreadyDone || weeksNeeded !== null
  // 시작일의 주 = 1주차, 다음 목요일 = 2주차 시작
  // 완료일 = N주차의 목요일 = upcomingThursday + (weeksNeeded - 2) * 7일
  const completionDate = alreadyDone
    ? todayKST()
    : weeksNeeded !== null
      ? upcomingThursday.add(weeksNeeded - 2, 'week').toDate()
      : null

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

  const resetAll = () => {
    if (!confirm('입력한 내용을 모두 초기화하시겠습니까?')) return
    setState({
      startChapter: 0,
      currentPoints: 0,
      startDate: dayjs(todayKST()).toISOString(),
      weekly: makeEmptyWeekly(),
      weeks: [makeEmptyWeek(todayKST())],
    })
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
    <div className="space-y-6">
      <ProgressBar
        startChapter={state.startChapter}
        currentPoints={state.currentPoints}
        completionDate={isDone ? formatDate(completionDate) : null}
      />

      {/* 현재 진행 상태 입력 */}
      <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 space-y-4">
        <div className="text-lg font-semibold text-emerald-300">현재 진행 상태</div>

        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
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
      />

      <div className="max-w-2xl mx-auto flex justify-end">
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 px-5 py-2.5 text-sm font-semibold transition shadow-lg shadow-red-500/10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3H14M6 3V2C6 1.45 6.45 1 7 1H9C9.55 1 10 1.45 10 2V3M3 3L4 14C4 14.55 4.45 15 5 15H11C11.55 15 12 14.55 12 14L13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          전체 초기화
        </button>
      </div>
    </div>
  )
}
