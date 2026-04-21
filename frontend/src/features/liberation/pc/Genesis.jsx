import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import {
  GENESIS_CHAPTERS,
  GENESIS_TOTAL,
  MONTHLY_BOSSES,
  QUEST_BOSS_IMAGE_BASE,
  formatDate,
} from '../data'
import { useLiberationStore } from '../store'
import {
  bossEarn,
  calcWeekPoints,
  calcDoneEarn,
  calcMonthlyEarn,
  getSchedulerWeekRange,
  computeCompletionDate,
} from '../utils'
import QuestSelector from './components/QuestSelector'
import PointsInput from './components/PointsInput'
import ProgressBar from './components/ProgressBar'
import WeeklyDefault from './components/WeeklyDefault'
import DatePicker from '../../../components/common/DatePicker'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

export default function Genesis() {
  const calcMode = useLiberationStore((s) => s.genesisCalcMode)
  const state = useLiberationStore((s) => s[s.genesisCalcMode])
  const setCalcMode = useLiberationStore((s) => s.setGenesisCalcMode)
  const updateSlot = useLiberationStore((s) => s.updateSlot)
  const resetSlot = useLiberationStore((s) => s.resetSlot)
  const setState = (updater) => updateSlot(updater)

  // 포인트 이월: 현재 퀘스트 required를 초과하면 자동으로 다음 퀘스트로 넘어감
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
  const doneEarn = calcDoneEarn(state.weekly)
  const monthlyEarn = calcMonthlyEarn(state.weekly)
  const monthlyDoneThisMonth = !!state.weekly.blackMage?.done

  // 주차별 모드 헤더 합산 (검은 마법사는 월별 슬롯 1회만 카운트)
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
      const r = getSchedulerWeekRange(state.startDate, idx + 1)
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

  const completionDate = useMemo(
    () => computeCompletionDate({
      calcMode, state, alreadyDone, remaining,
      weeklyEarn, doneEarn, monthlyEarn, monthlyDoneThisMonth,
    }),
    [calcMode, state, alreadyDone, remaining, weeklyEarn, doneEarn, monthlyEarn, monthlyDoneThisMonth],
  )
  const isDone = completionDate !== null

  const [resetOpen, setResetOpen] = useState(false)
  const doReset = () => {
    resetSlot()
    setResetOpen(false)
  }

  return (
    <>
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
        chapters={GENESIS_CHAPTERS}
        imageBase={QUEST_BOSS_IMAGE_BASE}
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

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={doReset}
        title="전체 초기화"
        description={`${calcMode === 'simple' ? '단순 계산' : '주차별 계산'} 모드의 입력을 모두 초기화하시겠습니까?\n\n시작 날짜, 현재 진행 상태, 주간 보스 설정이 모두 초기값으로 되돌아갑니다.\n다른 모드의 값은 유지됩니다.`}
        confirmText="초기화"
        destructive
      />
    </>
  )
}
