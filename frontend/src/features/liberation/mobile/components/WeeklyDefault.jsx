import BossRow from './BossRow'
import WeeklyScheduler from './WeeklyScheduler'

const DEFAULT_SEL = { difficulty: 'none', party: 1, done: false }

export default function WeeklyDefault({
  bosses,
  monthlyBosses = [],
  imageBase,
  makeEmptyConfig,
  weekly,
  onChange,
  totalWeekly,
  totalMonthly = 0,
  remaining,
  mode = 'simple',
  startDate,
  weeks,
  onChangeWeeks,
  hasScheduler = true,
  label = '주간 보스 설정',
  pass = null,
  passNowMult = 1,
}) {
  const updateBoss = (key, patch) => {
    const cur = weekly.bosses?.[key] ?? DEFAULT_SEL
    onChange({ ...weekly, bosses: { ...weekly.bosses, [key]: { ...cur, ...patch } } })
  }
  const updateBlackMage = (patch) => {
    onChange({ ...weekly, blackMage: { ...(weekly.blackMage ?? DEFAULT_SEL), ...patch } })
  }

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold" style={{ color: 'var(--accent-bright)' }}>{label}</div>
        <div className="text-sm tabular-nums">
          {mode === 'weekly' ? (
            <>
              <span className="font-semibold" style={{ color: 'var(--text-emphasis)' }}>{(totalWeekly + totalMonthly).toLocaleString()}</span>
              <span className="mx-1" style={{ color: 'var(--text-dim)' }}>/</span>
              <span className="font-semibold" style={{ color: 'var(--text-emphasis)' }}>{(remaining ?? 0).toLocaleString()}</span>
            </>
          ) : (
            <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>+{totalWeekly + totalMonthly}</span>
          )}
        </div>
      </div>

      {mode === 'simple' || !hasScheduler ? (
        <div className="space-y-2">
          {bosses.map((boss) => (
            <BossRow
              key={boss.key}
              boss={boss}
              sel={weekly.bosses?.[boss.key]}
              onChange={(patch) => updateBoss(boss.key, patch)}
              imageBase={imageBase}
              passMult={passNowMult}
            />
          ))}
          {monthlyBosses.map((boss) => (
            <BossRow
              key={boss.key}
              boss={boss}
              sel={weekly.blackMage}
              onChange={updateBlackMage}
              imageBase={imageBase}
              monthly
              passMult={passNowMult}
            />
          ))}
        </div>
      ) : (
        <WeeklyScheduler
          bosses={bosses}
          monthlyBoss={monthlyBosses[0] ?? null}
          imageBase={imageBase}
          makeEmptyConfig={makeEmptyConfig}
          startDate={startDate}
          weeks={weeks}
          onChangeWeeks={onChangeWeeks}
          pass={pass}
        />
      )}
    </div>
  )
}
