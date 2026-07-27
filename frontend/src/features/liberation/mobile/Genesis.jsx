import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api } from '../../../api/client'
import {
  GENESIS_CHAPTERS,
  GENESIS_TOTAL,
  WEEKLY_BOSSES,
  MONTHLY_BOSSES,
  QUEST_BOSS_IMAGE_BASE,
  LIBERATION_BOSS_IMAGE_BASE,
  formatDate,
} from '../data'
import { useLiberationStore, makeEmptyWeekly } from '../store'
import {
  bossEarn,
  calcWeekPoints,
  calcDoneEarn,
  calcMonthlyEarn,
  getSchedulerWeekRange,
  computeCompletionDate,
  makePassMultiplier,
} from '../utils'
import { liberationProgress } from '../logic'
import QuestSelector from '../pc/components/QuestSelector'
import PointsInput from '../pc/components/PointsInput'
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

  const passOn = useLiberationStore((s) => s.genesisPassOn)
  const setPassOn = useLiberationStore((s) => s.setGenesisPassOn)
  const { data: passCfg } = useQuery({
    queryKey: ['genesis-pass'],
    queryFn: () => api('/api/genesis-pass').catch(() => null),
    staleTime: 5 * 60 * 1000,
  })
  const passActive = !!passCfg?.active
  const passApplied = passActive && passOn
  const passForCalc = passApplied
    ? { multiplier: passCfg.multiplier, startDate: passCfg.start_date, endDate: passCfg.end_date }
    : null
  const passMultAt = makePassMultiplier(passForCalc)
  const passNowMult = passApplied ? passCfg.multiplier : 1

  const { alreadyDone, remaining } = liberationProgress(GENESIS_CHAPTERS, GENESIS_TOTAL, state.startChapter, state.currentPoints)
  const weeklyEarn = calcWeekPoints(state.weekly)
  const doneEarn = calcDoneEarn(state.weekly)
  const monthlyEarn = calcMonthlyEarn(state.weekly)
  const monthlyDoneThisMonth = !!state.weekly.blackMage?.done

  const headerWeekly = calcMode === 'weekly'
    ? (state.schedulerWeeks || []).reduce((s, w, i) => {
        const ms = getSchedulerWeekRange(state.startDate, i + 1).start.valueOf()
        return s + calcWeekPoints(w.config) * passMultAt(ms)
      }, 0)
    : weeklyEarn * passNowMult
  const headerMonthly = (() => {
    if (calcMode !== 'weekly') return monthlyEarn * passNowMult
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
          claimed[m] = bossEarn(MONTHLY_BOSSES[0], w.config.blackMage) * passMultAt(r.start.valueOf())
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
      pass: passApplied
        ? { multiplier: passCfg.multiplier, startDate: passCfg.start_date, endDate: passCfg.end_date }
        : null,
    }),
    [calcMode, state, alreadyDone, remaining, weeklyEarn, doneEarn, monthlyEarn, monthlyDoneThisMonth,
      passApplied, passCfg?.multiplier, passCfg?.start_date, passCfg?.end_date],
  )
  const isDone = completionDate !== null

  const [resetOpen, setResetOpen] = useState(false)
  const doReset = () => {
    resetSlot()
    setResetOpen(false)
  }

  return (
    <div className="space-y-4">
      {/* 계산 모드 세그먼트 */}
      <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}>
        {[{ key: 'simple', label: '일반' }, { key: 'weekly', label: '주차별' }].map((t) => {
          const active = calcMode === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setCalcMode(t.key)}
              className="flex-1 h-9 rounded-full text-sm font-bold"
              style={active ? {
                background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)',
                color: '#ffffff',
              } : { color: 'var(--text-muted)' }}
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

      {/* 현재 진행 상태 */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>현재 진행 상태</div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>시작 날짜</label>
            <DatePicker value={formatDate(state.startDate)} onChange={(d) => setState((prev) => ({ ...prev, startDate: dayjs(d).toISOString() }))} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>진행 중인 퀘스트</label>
            <QuestSelector chapters={GENESIS_CHAPTERS} imageBase={QUEST_BOSS_IMAGE_BASE} value={state.startChapter} onChange={(idx) => setState((prev) => ({ ...prev, startChapter: idx }))} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>현재 흔적</label>
            <div className="flex items-stretch rounded-lg border focus-within:border-[var(--input-border-focus)]" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}>
              <PointsInput
                value={state.currentPoints}
                max={3000}
                onChange={(n) => setState((prev) => ({ ...prev, currentPoints: n }))}
                className="flex-1 min-w-0 bg-transparent px-3 h-12 text-base text-right tabular-nums outline-none"
                style={{ color: 'var(--text-strong)' }}
              />
              <span className="flex items-center px-3 text-base border-l select-none tabular-nums" style={{ borderColor: 'var(--input-border)', color: 'var(--text-dim)' }}>
                / {(GENESIS_CHAPTERS[state.startChapter]?.required ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 제네시스 패스 */}
      {passActive && (
        <button
          type="button"
          onClick={() => setPassOn(!passOn)}
          className="w-full rounded-2xl border p-4 flex items-center gap-3 text-left"
          style={passOn ? {
            background: 'linear-gradient(120deg, #fdf3dd, #f7e3ba)',
            borderColor: '#e3b878',
            boxShadow: '0 0 0 1px rgba(227,184,120,.35), 0 8px 28px rgba(227,184,120,.18)',
          } : {
            background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)',
          }}
        >
          <div className="shrink-0 w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden" style={{ borderColor: '#e3c48f', background: 'var(--mpl-card)' }}>
            {passCfg.image?.url ? (
              <img src={passCfg.image.url} alt="제네시스 패스" className="w-14 h-auto" style={{ imageRendering: 'pixelated' }} />
            ) : (
              <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-dim)' }}>제네시스<br />패스</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: passOn ? 'var(--text-strong)' : 'var(--text-muted)' }}>
                패스 적용
                <span className="text-xs font-extrabold" style={{ color: '#c77e15' }}>×{passCfg.multiplier}</span>
              </div>
              <span className="relative shrink-0 rounded-full transition-colors" style={{ width: 40, height: 23, background: passOn ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' : '#9aa8b5' }}>
                <span className="absolute top-[3px] rounded-full bg-white transition-all" style={{ width: 17, height: 17, left: passOn ? 20 : 3 }} />
              </span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              패스 보유 시 포인트가 {passCfg.multiplier}배로 적립됩니다.
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={passOn ? { background: 'linear-gradient(180deg, #f7dcab, #eec584)', color: '#8a5f14', boxShadow: 'inset 0 0 0 1px #e3b878' } : { background: 'var(--mpl-row)', color: 'var(--text-dim)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}>
                {passCfg.start_date?.replace(/-/g, '.')} ~ {passCfg.end_date?.replace(/-/g, '.')}
              </span>
            </div>
          </div>
        </button>
      )}

      <WeeklyDefault
        bosses={WEEKLY_BOSSES}
        monthlyBosses={MONTHLY_BOSSES}
        imageBase={LIBERATION_BOSS_IMAGE_BASE}
        makeEmptyConfig={makeEmptyWeekly}
        weekly={state.weekly}
        onChange={(w) => setState((prev) => ({ ...prev, weekly: w }))}
        totalWeekly={headerWeekly}
        totalMonthly={headerMonthly}
        remaining={remaining}
        mode={calcMode}
        startDate={state.startDate}
        weeks={state.schedulerWeeks}
        onChangeWeeks={(w) => setState((prev) => ({ ...prev, schedulerWeeks: w }))}
        pass={passForCalc}
        passNowMult={passNowMult}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 2px 5px rgba(31,44,61,.25)',
            color: '#ffffff',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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
        description={`${calcMode === 'simple' ? '일반' : '주차별'} 모드의 입력을 모두 초기화하시겠습니까?\n\n시작 날짜, 현재 진행 상태, 주간 보스 설정이 모두 초기값으로 되돌아갑니다.\n다른 모드의 값은 유지됩니다.`}
        confirmText="초기화"
        destructive
      />
    </div>
  )
}
