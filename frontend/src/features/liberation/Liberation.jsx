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
import DatePicker from '../../components/DatePicker'

const STORAGE_KEY = 'maple-liberation'

function makeEmptyWeek(startDate) {
  const bosses = {}
  WEEKLY_BOSSES.forEach((b) => {
    bosses[b.key] = {
      enabled: false,
      difficulty: b.difficulties[0].key,
      party: 1,
    }
  })
  return {
    startDate: dayjs(startDate).toISOString(),
    bosses,
    blackMage: {
      enabled: false,
      difficulty: MONTHLY_BOSSES[0].difficulties[0].key,
      party: 1,
    },
  }
}

function calcWeekPoints(weekData) {
  let points = 0
  WEEKLY_BOSSES.forEach((b) => {
    const sel = weekData.bosses[b.key]
    if (!sel?.enabled) return
    const diff = b.difficulties.find((d) => d.key === sel.difficulty)
    if (!diff) return
    points += calcPoints(diff.points, sel.party)
  })
  if (weekData.blackMage?.enabled) {
    const bm = MONTHLY_BOSSES[0]
    const diff = bm.difficulties.find((d) => d.key === weekData.blackMage.difficulty)
    if (diff) points += calcPoints(diff.points, weekData.blackMage.party)
  }
  return points
}

export default function Liberation() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved) } catch { /* ignore */ }
    }
    return {
      startChapter: 0,
      currentPoints: 0,
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

  const initialCap = GENESIS_CHAPTERS[state.startChapter]?.required ?? 0
  const initialClamped = Math.min(state.currentPoints, initialCap)
  const initialAccumulated = GENESIS_CHAPTERS
    .slice(0, state.startChapter)
    .reduce((s, c) => s + c.required, 0) + initialClamped
  const alreadyDone = initialAccumulated >= GENESIS_TOTAL
  const completedWeekIdx = progressByWeek.findIndex((w) => w.completed)
  const isDone = alreadyDone || completedWeekIdx >= 0
  const completionDate = alreadyDone
    ? todayKST()
    : completedWeekIdx >= 0
      ? addWeeks(state.weeks[completedWeekIdx].startDate, 1)
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
              value={formatDate(state.weeks[0].startDate)}
              onChange={setFirstWeekDate}
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
    </div>
  )
}
