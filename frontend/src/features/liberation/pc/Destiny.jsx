import { DESTINY_CHAPTERS, DESTINY_QUEST_IMAGE_BASE } from '../data'
import { useLiberationStore } from '../store'
import ProgressBar from './components/ProgressBar'

export default function Destiny() {
  const calcMode = useLiberationStore((s) => s.destinyCalcMode)
  const setCalcMode = useLiberationStore((s) => s.setDestinyCalcMode)
  const state = useLiberationStore((s) => s.destinyCalcMode === 'weekly' ? s.destinyWeekly : s.destinySimple)

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
    </>
  )
}
