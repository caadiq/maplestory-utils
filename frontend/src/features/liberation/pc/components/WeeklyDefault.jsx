import Select from '../../../../components/common/Select'
import Tooltip from '../../../../components/common/Tooltip'
import WeeklyScheduler from './WeeklyScheduler'
import { WEEKLY_BOSSES, MONTHLY_BOSSES, LIBERATION_BOSS_IMAGE_BASE, calcPoints } from '../../data'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))
const NONE_DIFFICULTY = { key: 'none', label: '격파 불가', points: 0 }

function diffLabel(d, party) {
  if (d.key === 'none') return <span style={{ color: 'var(--text-dim)' }}>격파 불가</span>
  const earned = calcPoints(d.points, party)
  return (
    <span>
      {d.label} <span style={{ color: 'var(--accent-bright)' }}>+{earned}</span>
    </span>
  )
}

export function BossRow({ boss, sel, onChange, monthly = false, showDone = true }) {
  const disabled = sel.difficulty === 'none'
  const difficultyOptions = [NONE_DIFFICULTY, ...boss.difficulties]
    .map((d) => ({ value: d.key, label: diffLabel(d, sel.party) }))

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 h-16">
      <Tooltip text={boss.name}>
        <img src={`${LIBERATION_BOSS_IMAGE_BASE}/${boss.image}`} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
      </Tooltip>
      <span className="text-base font-semibold flex-1 truncate">
        {boss.name}
        {monthly && (
          <span
            className="ml-1.5 text-[11px] font-medium"
            style={{ color: 'var(--warning-text)' }}
          >
            월간
          </span>
        )}
      </span>

      <div className="w-36">
        <Select
          value={sel.difficulty}
          onChange={(v) => {
            if (v === 'none') onChange({ difficulty: 'none', done: false })
            else onChange({ difficulty: v })
          }}
          options={difficultyOptions}
        />
      </div>
      <div className="w-20">
        <Select
          value={sel.party}
          onChange={(v) => onChange({ party: v })}
          options={PARTY_OPTIONS}
          disabled={disabled}
        />
      </div>
      {showDone && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ done: !sel.done })}
          className="shrink-0 w-20 rounded-md h-8 text-xs font-semibold border disabled:cursor-not-allowed"
          style={disabled ? {
            borderColor: 'var(--panel-border)',
            color: 'var(--text-dim)',
          } : sel.done ? {
            background: 'var(--selected-bg)',
            borderColor: 'var(--selected-border)',
            color: 'var(--accent-bright)',
          } : {
            borderColor: 'var(--btn-border)',
            color: 'var(--text-dim)',
          }}
        >
          {sel.done ? '완료' : '미완료'}
        </button>
      )}
    </div>
  )
}

export default function WeeklyDefault({ weekly, onChange, totalWeekly, totalMonthly, remaining, mode = 'simple', startDate, weeks, onChangeWeeks }) {
  const updateBoss = (key, patch) => {
    onChange({ ...weekly, bosses: { ...weekly.bosses, [key]: { ...weekly.bosses[key], ...patch } } })
  }
  const updateBlackMage = (patch) => {
    onChange({ ...weekly, blackMage: { ...weekly.blackMage, ...patch } })
  }

  return (
    <div
      className="max-w-3xl mx-auto rounded-2xl border p-6 space-y-4"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold" style={{ color: 'var(--accent-bright)' }}>주간 보스 설정</div>
        <div className="text-sm tabular-nums">
          {mode === 'weekly' ? (
            <>
              <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>{totalWeekly}</span>
              <span className="mx-1" style={{ color: 'var(--text-dim)' }}>+</span>
              <span className="font-semibold" style={{ color: 'var(--warning-text-bright)' }}>{totalMonthly}</span>
              <span className="mx-1" style={{ color: 'var(--text-dim)' }}>/</span>
              <span className="font-semibold" style={{ color: 'var(--text-emphasis)' }}>{(remaining ?? 0).toLocaleString()}</span>
            </>
          ) : (
            <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>+{totalWeekly + totalMonthly}</span>
          )}
        </div>
      </div>

      {mode === 'simple' ? (
        <div>
          {WEEKLY_BOSSES.map((boss, i) => (
            <div
              key={boss.key}
              className={i > 0 ? 'border-t' : ''}
              style={i > 0 ? { borderColor: 'var(--row-divider)' } : undefined}
            >
              <BossRow
                boss={boss}
                sel={weekly.bosses[boss.key]}
                onChange={(patch) => updateBoss(boss.key, patch)}
              />
            </div>
          ))}
          {MONTHLY_BOSSES.map((boss) => (
            <div
              key={boss.key}
              className="border-t"
              style={{ borderColor: 'var(--row-divider)' }}
            >
              <BossRow
                boss={boss}
                sel={weekly.blackMage}
                onChange={updateBlackMage}
                monthly
              />
            </div>
          ))}
        </div>
      ) : (
        <WeeklyScheduler
          startDate={startDate}
          weeks={weeks}
          onChangeWeeks={onChangeWeeks}
        />
      )}
    </div>
  )
}
