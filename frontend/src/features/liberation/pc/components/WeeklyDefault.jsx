import { Fragment } from 'react'
import Select from '../../../../components/common/Select'
import Tooltip from '../../../../components/common/Tooltip'
import WeeklyScheduler from './WeeklyScheduler'
import { calcPoints } from '../../data'
import { computeSchedulerBreakdown } from '../../utils'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))
const NONE_DIFFICULTY = { key: 'none', label: '격파 불가', points: 0 }

function diffLabel(d, party, mult = 1) {
  if (d.key === 'none') return <span style={{ color: 'var(--text-dim)' }}>격파 불가</span>
  const earned = calcPoints(d.points, party) * mult
  return (
    <span>
      {d.label} <span style={{ color: 'var(--accent-bright)' }}>+{earned}</span>
    </span>
  )
}

export function BossRow({ boss, sel, onChange, imageBase, monthly = false, showDone = true, passMult = 1 }) {
  const disabled = sel.difficulty === 'none'
  const difficultyOptions = [NONE_DIFFICULTY, ...boss.difficulties]
    .map((d) => ({ value: d.key, label: diffLabel(d, sel.party, passMult) }))

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 h-16">
      <Tooltip text={boss.name}>
        <img src={`${imageBase}/${boss.image}`} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
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
          title="이번 주 해당 난이도를 이미 클리어했는지 여부"
          className="shrink-0 w-20 rounded-md h-8 text-xs font-semibold border"
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
    onChange({ ...weekly, bosses: { ...weekly.bosses, [key]: { ...weekly.bosses[key], ...patch } } })
  }
  const updateBlackMage = (patch) => {
    onChange({ ...weekly, blackMage: { ...weekly.blackMage, ...patch } })
  }

  // 총합 hover 패널용 주차별 분해 (주차별 모드 + 월간 보스 있을 때만)
  const hasMonthly = monthlyBosses.length > 0
  const breakdown = mode === 'weekly' && hasMonthly
    ? computeSchedulerBreakdown(weeks || [], startDate, bosses, monthlyBosses[0], pass)
    : []

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
        <div className="text-lg font-semibold" style={{ color: 'var(--accent-bright)' }}>{label}</div>
        <div className="text-sm tabular-nums">
          {mode === 'weekly' ? (
            <>
              {hasMonthly ? (
                <span className="relative group inline-block align-middle">
                  <span
                    className="font-semibold border-b border-dotted"
                    style={{ color: 'var(--text-emphasis)', borderColor: 'var(--text-dim)' }}
                  >
                    {(totalWeekly + totalMonthly).toLocaleString()}
                  </span>
                  {/* 패널 배경(--tooltip-bg)은 두 테마 모두 어두우므로 내부 색은 어두운 배경용 밝은 값으로 고정 */}
                  <span className="absolute right-0 top-full z-50 hidden group-hover:block pt-2 cursor-default">
                    <span
                      className="block rounded-lg border p-3.5 shadow-xl text-left text-[15px]"
                      style={{
                        background: 'var(--tooltip-bg)',
                        borderColor: 'var(--tooltip-border)',
                        minWidth: '15rem',
                      }}
                    >
                      <span className="flex items-center gap-5 pb-2.5 mb-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                        <span>
                          <span style={{ color: '#6ee7b7' }}>주간</span>
                          <span className="ml-1.5 tabular-nums" style={{ color: '#ffffff' }}>{totalWeekly.toLocaleString()}</span>
                        </span>
                        <span>
                          <span style={{ color: '#fcd34d' }}>월간</span>
                          <span className="ml-1.5 tabular-nums" style={{ color: '#ffffff' }}>{totalMonthly.toLocaleString()}</span>
                        </span>
                      </span>
                      <span className="block max-h-60 overflow-y-auto">
                        <span className="grid items-center gap-x-4 gap-y-1.5 tabular-nums" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                          <span className="text-xs pb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>주차</span>
                          <span className="text-xs pb-0.5 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>흔적</span>
                          <span className="text-xs pb-0.5 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>누적</span>
                          {breakdown.map((r) => (
                            <Fragment key={r.n}>
                              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{r.n}주</span>
                              <span className="text-right">
                                <span style={{ color: '#6ee7b7' }}>+{r.weekly.toLocaleString()}</span>
                                {r.monthly > 0 && (
                                  <span className="ml-1" style={{ color: '#fcd34d' }}>+{r.monthly.toLocaleString()}</span>
                                )}
                              </span>
                              <span className="text-right" style={{ color: '#ffffff' }}>{r.cumulative.toLocaleString()}</span>
                            </Fragment>
                          ))}
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              ) : (
                <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>{totalWeekly.toLocaleString()}</span>
              )}
              <span className="mx-1" style={{ color: 'var(--text-dim)' }}>/</span>
              <span className="font-semibold" style={{ color: 'var(--text-emphasis)' }}>{(remaining ?? 0).toLocaleString()}</span>
            </>
          ) : (
            <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>+{totalWeekly + totalMonthly}</span>
          )}
        </div>
      </div>

      {mode === 'simple' || !hasScheduler ? (
        <div>
          {bosses.map((boss, i) => (
            <div
              key={boss.key}
              className={i > 0 ? 'border-t' : ''}
              style={i > 0 ? { borderColor: 'var(--row-divider)' } : undefined}
            >
              <BossRow
                boss={boss}
                sel={weekly.bosses[boss.key]}
                onChange={(patch) => updateBoss(boss.key, patch)}
                imageBase={imageBase}
                passMult={passNowMult}
              />
            </div>
          ))}
          {monthlyBosses.map((boss) => (
            <div
              key={boss.key}
              className="border-t"
              style={{ borderColor: 'var(--row-divider)' }}
            >
              <BossRow
                boss={boss}
                sel={weekly.blackMage}
                onChange={updateBlackMage}
                imageBase={imageBase}
                monthly
                passMult={passNowMult}
              />
            </div>
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
