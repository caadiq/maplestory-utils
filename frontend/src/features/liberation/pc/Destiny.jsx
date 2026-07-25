import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import {
  DESTINY_CHAPTERS,
  DESTINY_TOTAL,
  DESTINY_PRIMARY_TOTAL,
  DESTINY_QUEST_IMAGE_BASE,
  DESTINY_BOSSES,
  DESTINY_BOSS_IMAGE_BASE,
  formatDate,
} from '../data'
import { useLiberationStore, makeEmptyDestinyWeekly } from '../store'
import { calcWeekPoints, calcDoneEarn, computeCompletionDate } from '../utils'
import { liberationProgress } from '../logic'
import ProgressBar from './components/ProgressBar'
import QuestSelector from './components/QuestSelector'
import PointsInput from './components/PointsInput'
import WeeklyDefault from './components/WeeklyDefault'
import DatePicker from '../../../components/common/DatePicker'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

export default function Destiny() {
  const calcMode = useLiberationStore((s) => s.destinyCalcMode)
  const setCalcMode = useLiberationStore((s) => s.setDestinyCalcMode)
  const state = useLiberationStore((s) => s.destinyCalcMode === 'weekly' ? s.destinyWeekly : s.destinySimple)
  const updateSlot = useLiberationStore((s) => s.updateDestinySlot)
  const resetSlot = useLiberationStore((s) => s.resetDestinySlot)
  const setState = (updater) => updateSlot(updater)

  // 포인트 이월: 현재 퀘스트 required 를 초과하면 다음 퀘스트로 넘어감
  const { alreadyDone, remaining } = liberationProgress(DESTINY_CHAPTERS, DESTINY_TOTAL, state.startChapter, state.currentPoints)

  const weeklyEarn = calcWeekPoints(state.weekly, DESTINY_BOSSES)
  const doneEarn = calcDoneEarn(state.weekly, DESTINY_BOSSES)

  const headerWeekly = calcMode === 'weekly'
    ? (state.schedulerWeeks || []).reduce((s, w) => s + calcWeekPoints(w.config, DESTINY_BOSSES), 0)
    : weeklyEarn

  const completionDate = useMemo(
    () => computeCompletionDate({
      calcMode, state, alreadyDone, remaining,
      weeklyEarn, doneEarn,
      monthlyEarn: 0,
      monthlyDoneThisMonth: false,
      bosses: DESTINY_BOSSES,
      monthlyBoss: null,
      makeEmptyConfig: makeEmptyDestinyWeekly,
    }),
    [calcMode, state, alreadyDone, remaining, weeklyEarn, doneEarn],
  )
  const isDone = completionDate !== null

  // 1차 해방(무기 전승): phase 1 챕터까지만 따로 계산
  const primary = liberationProgress(DESTINY_CHAPTERS, DESTINY_PRIMARY_TOTAL, state.startChapter, state.currentPoints)
  const primaryDate = useMemo(
    () => primary.alreadyDone ? null : computeCompletionDate({
      calcMode, state, alreadyDone: false, remaining: primary.remaining,
      weeklyEarn, doneEarn,
      monthlyEarn: 0,
      monthlyDoneThisMonth: false,
      bosses: DESTINY_BOSSES,
      monthlyBoss: null,
      makeEmptyConfig: makeEmptyDestinyWeekly,
    }),
    [calcMode, state, primary.alreadyDone, primary.remaining, weeklyEarn, doneEarn],
  )

  const [resetOpen, setResetOpen] = useState(false)
  const doReset = () => {
    resetSlot()
    setResetOpen(false)
  }

  return (
    <>
      {/* 계산 모드 탭 + 전체 초기화 */}
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div
          className="flex gap-1 p-1 rounded-full"
          style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
        >
          {[
            { key: 'simple', label: '일반' },
            { key: 'weekly', label: '주차별' },
          ].map((t) => {
            const active = calcMode === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setCalcMode(t.key)}
                className="px-8 h-9 rounded-full text-sm font-bold transition"
                style={active ? {
                  background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
                  color: '#ffffff',
                  textShadow: '0 1px 2px rgba(31,80,110,.4)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
                } : {
                  color: 'var(--text-muted)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold hover:brightness-105"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))',
            color: '#ffffff',
            textShadow: '0 1px 1px rgba(44,55,69,.25)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 2px 5px rgba(31,44,61,.25)',
          }}
        >
          🗑 전체 초기화
        </button>
      </div>

      <ProgressBar
        chapters={DESTINY_CHAPTERS}
        imageBase={DESTINY_QUEST_IMAGE_BASE}
        startChapter={state.startChapter}
        currentPoints={state.currentPoints}
        completionDate={isDone ? formatDate(completionDate) : null}
        primaryCompletion={{ done: primary.alreadyDone, date: primaryDate ? formatDate(primaryDate) : null }}
      />

      {/* 현재 진행 상태 입력 */}
      <div
        className="max-w-3xl mx-auto rounded-xl p-5 space-y-4"
        style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
      >
        <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>현재 진행 상태</div>

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
              chapters={DESTINY_CHAPTERS}
              imageBase={DESTINY_QUEST_IMAGE_BASE}
              value={state.startChapter}
              onChange={(idx) => setState((prev) => ({ ...prev, startChapter: idx }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>현재 결의</label>
            <div
              className="flex items-stretch rounded-lg border focus-within:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
              }}
            >
              <PointsInput
                value={state.currentPoints}
                max={20000}
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
                / {(DESTINY_CHAPTERS[state.startChapter]?.required ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <WeeklyDefault
        bosses={DESTINY_BOSSES}
        imageBase={DESTINY_BOSS_IMAGE_BASE}
        makeEmptyConfig={makeEmptyDestinyWeekly}
        weekly={state.weekly}
        onChange={(w) => setState((prev) => ({ ...prev, weekly: w }))}
        totalWeekly={headerWeekly}
        remaining={remaining}
        mode={calcMode}
        startDate={state.startDate}
        weeks={state.schedulerWeeks}
        onChangeWeeks={(w) => setState((prev) => ({ ...prev, schedulerWeeks: w }))}
      />


      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={doReset}
        title="전체 초기화"
        description={`${calcMode === 'simple' ? '일반' : '주차별'} 모드의 입력을 모두 초기화하시겠습니까?\n\n시작 날짜, 현재 진행 상태, 주간 보스 설정이 모두 초기값으로 되돌아갑니다.\n다른 모드의 값은 유지됩니다.`}
        confirmText="초기화"
        destructive
      />
    </>
  )
}
