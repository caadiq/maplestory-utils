import Select from '../../../components/Select'
import Tooltip from '../../../components/Tooltip'
import WeeklyScheduler from './WeeklyScheduler'
import { WEEKLY_BOSSES, MONTHLY_BOSSES, LIBERATION_BOSS_IMAGE_BASE, calcPoints } from '../data'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))
const NONE_DIFFICULTY = { key: 'none', label: '격파 불가', points: 0 }

function diffLabel(d, party) {
  if (d.key === 'none') return <span className="text-gray-500">격파 불가</span>
  const earned = calcPoints(d.points, party)
  return (
    <span>
      {d.label} <span className="text-emerald-400">+{earned}</span>
    </span>
  )
}

export function BossRow({ boss, sel, onChange, monthly = false, showDone = true }) {
  const disabled = sel.difficulty === 'none'
  const difficultyOptions = [NONE_DIFFICULTY, ...boss.difficulties]
    .map((d) => ({ value: d.key, label: diffLabel(d, sel.party) }))

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 h-16 transition">
      <Tooltip text={boss.name}>
        <img src={`${LIBERATION_BOSS_IMAGE_BASE}/${boss.image}`} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
      </Tooltip>
      <span className="text-base font-semibold flex-1 truncate">
        {boss.name}
        {monthly && <span className="ml-1.5 text-[11px] text-amber-400/80 font-medium">월간</span>}
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
          className={`shrink-0 w-20 rounded-md h-8 text-xs font-semibold transition border ${
            disabled
              ? 'border-white/5 text-gray-700 cursor-not-allowed'
              : sel.done
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
          }`}
        >
          {sel.done ? '완료' : '미완료'}
        </button>
      )}
    </div>
  )
}

export default function WeeklyDefault({ weekly, onChange, totalWeekly, totalMonthly, mode = 'simple', startDate, weeks, onChangeWeeks }) {
  const updateBoss = (key, patch) => {
    onChange({ ...weekly, bosses: { ...weekly.bosses, [key]: { ...weekly.bosses[key], ...patch } } })
  }
  const updateBlackMage = (patch) => {
    onChange({ ...weekly, blackMage: { ...weekly.blackMage, ...patch } })
  }

  return (
    <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-emerald-300">주간 보스 설정</div>
        <div className="text-sm tabular-nums">
          {mode === 'weekly' ? (
            <>
              <span className="text-emerald-300 font-semibold">{totalWeekly}</span>
              <span className="text-gray-500 mx-1">+</span>
              <span className="text-amber-300 font-semibold">{totalMonthly}</span>
              <span className="text-gray-500 mx-1">/</span>
              <span className="text-gray-300 font-semibold">6500</span>
            </>
          ) : (
            <span className="text-emerald-300 font-semibold">+{totalWeekly + totalMonthly}</span>
          )}
        </div>
      </div>

      {mode === 'simple' ? (
        <div className="divide-y divide-white/5">
          {WEEKLY_BOSSES.map((boss) => (
            <BossRow
              key={boss.key}
              boss={boss}
              sel={weekly.bosses[boss.key]}
              onChange={(patch) => updateBoss(boss.key, patch)}
            />
          ))}
          {MONTHLY_BOSSES.map((boss) => (
            <BossRow
              key={boss.key}
              boss={boss}
              sel={weekly.blackMage}
              onChange={updateBlackMage}
              monthly
            />
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
