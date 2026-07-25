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

  // 제네시스 패스: 운영자 설정(시즌/배수/기간)은 서버에서, 보유 여부 토글은 로컬에서
  const passOn = useLiberationStore((s) => s.genesisPassOn)
  const setPassOn = useLiberationStore((s) => s.setGenesisPassOn)
  const { data: passCfg } = useQuery({
    queryKey: ['genesis-pass'],
    queryFn: () => api('/api/genesis-pass').catch(() => null),
    staleTime: 5 * 60 * 1000,
  })
  const passActive = !!passCfg?.active
  const passApplied = passActive && passOn
  // 완료일 계산과 총합 표시가 동일한 배수 규칙을 공유 (적용 기간 안의 적립만 배수)
  const passForCalc = passApplied
    ? { multiplier: passCfg.multiplier, startDate: passCfg.start_date, endDate: passCfg.end_date }
    : null
  const passMultAt = makePassMultiplier(passForCalc)
  // 단순 모드 총합은 '주당 적립 rate'라 날짜가 없음 → passActive(오늘이 기간 내)면 곧 배수 적용
  const passNowMult = passApplied ? passCfg.multiplier : 1

  // 포인트 이월: 현재 퀘스트 required를 초과하면 자동으로 다음 퀘스트로 넘어감
  const { alreadyDone, remaining } = liberationProgress(GENESIS_CHAPTERS, GENESIS_TOTAL, state.startChapter, state.currentPoints)
  const weeklyEarn = calcWeekPoints(state.weekly)
  const doneEarn = calcDoneEarn(state.weekly)
  const monthlyEarn = calcMonthlyEarn(state.weekly)
  const monthlyDoneThisMonth = !!state.weekly.blackMage?.done

  // 주차별 모드 헤더 합산 (검은 마법사는 월별 슬롯 1회만 카운트)
  // 패스 적용 시: 주차/월의 적립일이 패스 기간 안이면 배수 반영 (완료일 계산과 동일 규칙)
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
        chapters={GENESIS_CHAPTERS}
        imageBase={QUEST_BOSS_IMAGE_BASE}
        startChapter={state.startChapter}
        currentPoints={state.currentPoints}
        completionDate={isDone ? formatDate(completionDate) : null}
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
              chapters={GENESIS_CHAPTERS}
              imageBase={QUEST_BOSS_IMAGE_BASE}
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

      {/* 제네시스 패스 — 시즌 진행 중일 때만 노출. 켜면 포인트 배수가 계산에 반영됨 */}
      {passActive && (
        <button
          type="button"
          onClick={() => setPassOn(!passOn)}
          className="max-w-3xl mx-auto w-full rounded-2xl border p-5 flex items-center gap-4 text-left transition-shadow"
          style={passOn ? {
            background: 'linear-gradient(120deg, #fdf3dd, #f7e3ba)',
            borderColor: '#e3b878',
            boxShadow: '0 0 0 1px rgba(227,184,120,.35), 0 8px 28px rgba(227,184,120,.18)',
          } : {
            background: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            boxShadow: 'var(--panel-shadow)',
          }}
        >
          <div
            className="shrink-0 w-[88px] h-[88px] rounded-xl border flex items-center justify-center overflow-hidden"
            style={{
              borderColor: '#e3b878',
              background: 'linear-gradient(180deg, #f7dcab, #eec584)',
            }}
          >
            {passCfg.image?.url ? (
              <img
                src={passCfg.image.url}
                alt="제네시스 패스"
                className="w-[76px] h-auto"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <span className="text-xs text-center leading-tight" style={{ color: 'var(--text-dim)' }}>제네시스<br />패스</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div
                className="font-semibold flex items-center gap-1.5"
                style={{ color: passOn ? 'var(--text-strong)' : 'var(--text-muted)' }}
              >
                제네시스 패스 적용
                <span className="text-sm font-extrabold" style={{ color: 'var(--genesis-date)' }}>×{passCfg.multiplier}</span>
              </div>
              <span
                className="relative shrink-0 rounded-full transition-colors"
                style={{ width: 46, height: 26, background: passOn ? 'var(--genesis-date)' : '#374151' }}
              >
                <span
                  className="absolute top-[3px] rounded-full bg-white transition-all"
                  style={{ width: 20, height: 20, left: passOn ? 23 : 3 }}
                />
              </span>
            </div>
            <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
              패스 보유 시 보스 처치 포인트가 {passCfg.multiplier}배로 적립됩니다.
            </div>
            <div className="mt-2.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                style={passOn
                  ? { background: 'linear-gradient(180deg, #f7dcab, #eec584)', color: '#8a5f14' }
                  : { background: 'rgba(31,44,61,0.08)', color: 'var(--text-dim)' }}
              >
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
