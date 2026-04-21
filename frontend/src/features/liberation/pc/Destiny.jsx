import dayjs from 'dayjs'
import { DESTINY_CHAPTERS, DESTINY_QUEST_IMAGE_BASE, formatDate } from '../data'
import { useLiberationStore } from '../store'
import ProgressBar from './components/ProgressBar'
import QuestSelector from './components/QuestSelector'
import PointsInput from './components/PointsInput'
import DatePicker from '../../../components/common/DatePicker'

export default function Destiny() {
  const calcMode = useLiberationStore((s) => s.destinyCalcMode)
  const setCalcMode = useLiberationStore((s) => s.setDestinyCalcMode)
  const state = useLiberationStore((s) => s.destinyCalcMode === 'weekly' ? s.destinyWeekly : s.destinySimple)
  const updateSlot = useLiberationStore((s) => s.updateDestinySlot)
  const setState = (updater) => updateSlot(updater)

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
        chapters={DESTINY_CHAPTERS}
        imageBase={DESTINY_QUEST_IMAGE_BASE}
        startChapter={state.startChapter}
        currentPoints={state.currentPoints}
        completionDate={null}
        completionColor="var(--destiny-date)"
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
    </>
  )
}
