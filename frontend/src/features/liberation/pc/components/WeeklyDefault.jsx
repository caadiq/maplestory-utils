import { Fragment } from 'react'
import Select from '../../../../components/common/Select'
import Tooltip from '../../../../components/common/Tooltip'
import WeeklyScheduler from './WeeklyScheduler'
import { calcPoints } from '../../data'
import { computeSchedulerBreakdown } from '../../utils'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))
const NONE_DIFFICULTY = { key: 'none', label: '격파 불가', points: 0 }
// persist된 구버전 데이터에 신규 보스 key가 없을 때의 기본 선택값 (렌더 크래시 방지)
const DEFAULT_SEL = { difficulty: 'none', party: 1, done: false }

function diffLabel(d, party, mult = 1) {
  if (d.key === 'none') return <span style={{ color: 'var(--text-dim)' }}>격파 불가</span>
  const earned = calcPoints(d.points, party) * mult
  return (
    <span>
      {d.label} <span style={{ color: 'var(--accent-bright)' }}>+{earned}</span>
    </span>
  )
}

export function BossRow({ boss, sel = DEFAULT_SEL, onChange, imageBase, monthly = false, showDone = true, passMult = 1 }) {
  const disabled = sel.difficulty === 'none'
  const difficultyOptions = [NONE_DIFFICULTY, ...boss.difficulties]
    .map((d) => ({ value: d.key, label: diffLabel(d, sel.party, passMult) }))

  return (
    <div
      className="flex items-center gap-3 rounded-[10px] px-3.5 h-16"
      style={{ background: '#f6f9fb', boxShadow: 'inset 0 0 0 1px #e3eaf0' }}
    >
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
          className="shrink-0 w-20 rounded-full h-8 text-xs font-semibold"
          style={disabled ? {
            background: '#eef2f6',
            color: 'var(--text-dim)',
            boxShadow: 'inset 0 0 0 1px #dbe3ea',
          } : sel.done ? {
            background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))',
            color: '#ffffff',
            textShadow: '0 1px 1px rgba(44,55,69,.25)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), 0 2px 5px rgba(31,44,61,.15)',
          } : {
            background: 'linear-gradient(180deg, #aeb9c6, #93a1b0)',
            color: '#ffffff',
            textShadow: '0 1px 1px rgba(44,55,69,.25)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 2px 5px rgba(31,44,61,.12)',
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
    const cur = weekly.bosses?.[key] ?? DEFAULT_SEL
    onChange({ ...weekly, bosses: { ...weekly.bosses, [key]: { ...cur, ...patch } } })
  }
  const updateBlackMage = (patch) => {
    onChange({ ...weekly, blackMage: { ...(weekly.blackMage ?? DEFAULT_SEL), ...patch } })
  }

  // 총합 hover 패널용 주차별 분해 (주차별 모드 + 월간 보스 있을 때만)
  const hasMonthly = monthlyBosses.length > 0
  const breakdown = mode === 'weekly' && hasMonthly
    ? computeSchedulerBreakdown(weeks || [], startDate, bosses, monthlyBosses[0], pass)
    : []

  return (
    <div
      className="max-w-3xl mx-auto rounded-xl p-5 space-y-3"
      style={{ background: '#ffffff', boxShadow: 'inset 0 0 0 1px #dbe3ea' }}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</div>
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
        <div className="space-y-1.5">
          {bosses.map((boss) => (
            <div key={boss.key}>
              <BossRow
                boss={boss}
                sel={weekly.bosses?.[boss.key]}
                onChange={(patch) => updateBoss(boss.key, patch)}
                imageBase={imageBase}
                passMult={passNowMult}
              />
            </div>
          ))}
          {monthlyBosses.map((boss) => (
            <div key={boss.key}>
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
