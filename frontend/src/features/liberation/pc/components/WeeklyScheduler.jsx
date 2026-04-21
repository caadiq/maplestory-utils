import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bossEarn, calcWeekPoints as calcWeeklySum, getSchedulerWeekRange as getWeekRange } from '../../utils'
import { BossRow } from './WeeklyDefault'

function formatRange(r) {
  const fmt = (d) => `${d.month() + 1}/${d.date()}`
  return `${fmt(r.start)} ~ ${fmt(r.end)}`
}

const DIFF_BADGE = {
  easy: { label: 'E', color: '#22c55e', border: 'rgba(34,197,94,0.4)', bg: 'rgba(34,197,94,0.15)' },
  normal: { label: 'N', color: '#60a5fa', border: 'rgba(96,165,250,0.4)', bg: 'rgba(96,165,250,0.15)' },
  hard: { label: 'H', color: '#f87171', border: 'rgba(248,113,113,0.4)', bg: 'rgba(248,113,113,0.15)' },
  chaos: { label: 'C', color: '#c084fc', border: 'rgba(192,132,252,0.45)', bg: 'rgba(192,132,252,0.15)' },
  extreme: { label: 'X', color: '#f59e0b', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.2)' },
}

function BossAvatar({ boss, imageBase, difficulty, size = 40 }) {
  const badge = DIFF_BADGE[difficulty]
  const enabled = difficulty && difficulty !== 'none'
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`rounded-md overflow-hidden border ${enabled ? '' : 'opacity-30 grayscale'}`}
        style={{
          width: size,
          height: size,
          background: 'var(--surface-nested)',
          borderColor: 'var(--panel-border)',
        }}
      >
        <img src={`${imageBase}/${boss.image}`} alt={boss.name} className="w-full h-full object-cover" />
      </div>
      <div
        className="text-[10px] font-bold leading-none rounded flex items-center justify-center border"
        style={{
          width: 16, height: 16,
          color: badge?.color || 'var(--text-dim)',
          background: badge?.bg || 'transparent',
          borderColor: badge?.border || 'var(--panel-border)',
        }}
      >
        {badge?.label || '-'}
      </div>
    </div>
  )
}

function WeekEditor({ config, onChange, isCurrent, monthlyLockedByWeek, bosses, monthlyBoss, imageBase }) {
  const updateBoss = (key, patch) => {
    onChange({ ...config, bosses: { ...config.bosses, [key]: { ...config.bosses[key], ...patch } } })
  }
  const updateBlackMage = (patch) => {
    onChange({ ...config, blackMage: { ...config.blackMage, ...patch } })
  }

  const blackmageLocked = monthlyLockedByWeek != null

  return (
    <div>
      {bosses.map((boss, i) => (
        <div
          key={boss.key}
          className={i > 0 ? 'border-t' : ''}
          style={i > 0 ? { borderColor: 'var(--row-divider)' } : undefined}
        >
          <BossRow
            boss={boss}
            sel={config.bosses[boss.key]}
            onChange={(patch) => updateBoss(boss.key, patch)}
            imageBase={imageBase}
            showDone={isCurrent}
          />
        </div>
      ))}
      {monthlyBoss && (
        <div
          className={`border-t ${blackmageLocked ? 'opacity-40 pointer-events-none' : ''}`}
          style={{ borderColor: 'var(--row-divider)' }}
        >
          <BossRow
            boss={monthlyBoss}
            sel={blackmageLocked ? { difficulty: 'none', party: 1, done: false } : config.blackMage}
            onChange={updateBlackMage}
            imageBase={imageBase}
            monthly
            showDone={isCurrent}
          />
        </div>
      )}
      {monthlyBoss && blackmageLocked && (
        <div
          className="text-[11px] px-3 py-2"
          style={{ color: 'var(--warning-text)' }}
        >
          이번 달 검은 마법사는 {monthlyLockedByWeek}주차에 배정되어 있습니다.
        </div>
      )}
    </div>
  )
}

export default function WeeklyScheduler({
  bosses,
  monthlyBoss = null,
  imageBase,
  makeEmptyConfig,
  startDate,
  weeks: weeksProp,
  onChangeWeeks,
}) {
  const weeks = weeksProp && weeksProp.length > 0
    ? weeksProp
    : [{ id: 1, config: makeEmptyConfig() }]
  const setWeeks = (updater) => {
    const next = typeof updater === 'function' ? updater(weeks) : updater
    onChangeWeeks?.(next)
  }
  const [expanded, setExpanded] = useState(null)
  const nextId = () => (weeks[weeks.length - 1]?.id ?? 0) + 1

  const addWeek = () => {
    const id = nextId()
    setWeeks((prev) => {
      const last = prev[prev.length - 1]
      const base = last ? JSON.parse(JSON.stringify(last.config)) : makeEmptyConfig()
      // done 상태는 복사하지 않음
      Object.keys(base.bosses).forEach((k) => { base.bosses[k].done = false })
      if (base.blackMage) base.blackMage.done = false

      // 월간 보스가 이미 같은 달에 배정되어 있으면 새 주차의 월간은 초기화
      if (monthlyBoss && startDate && base.blackMage?.difficulty && base.blackMage.difficulty !== 'none') {
        const newIdx = prev.length + 1
        const newMonth = getWeekRange(startDate, newIdx).start.format('YYYY-MM')
        const existsInSameMonth = prev.some((p, i) => {
          if (!p.config.blackMage?.difficulty || p.config.blackMage.difficulty === 'none') return false
          return getWeekRange(startDate, i + 1).start.format('YYYY-MM') === newMonth
        })
        if (existsInSameMonth) {
          base.blackMage = { difficulty: 'none', party: 1, done: false }
        }
      }

      return [...prev, { id, config: base }]
    })
    setExpanded(id)
  }

  const removeWeek = (id) => {
    setWeeks((prev) => prev.filter((w) => w.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const updateWeek = (id, config) => {
    setWeeks((prev) => prev.map((w) => (w.id === id ? { ...w, config } : w)))
  }

  // 월간 보스 슬롯 배정: 각 주차가 겹치는 달 중 하나를 선점
  const monthlyLocks = (() => {
    if (!monthlyBoss || !startDate) return {}
    const claimed = {} // month -> weekNum (1-based)
    weeks.forEach((w, idx) => {
      const diff = w.config.blackMage?.difficulty
      if (!diff || diff === 'none') return
      const r = getWeekRange(startDate, idx + 1)
      const months = [r.start.format('YYYY-MM'), r.end.format('YYYY-MM')]
      for (const m of months) {
        if (!(m in claimed)) {
          claimed[m] = idx + 1
          return
        }
      }
    })
    const locks = {}
    weeks.forEach((w, idx) => {
      const r = getWeekRange(startDate, idx + 1)
      const months = [r.start.format('YYYY-MM'), r.end.format('YYYY-MM')]
      if (months.some((m) => claimed[m] === idx + 1)) return
      if (months.every((m) => m in claimed)) {
        locks[idx] = claimed[months[0]] ?? claimed[months[1]]
      }
    })
    return locks
  })()

  return (
    <div className="space-y-2">
      {weeks.map((w, idx) => {
        const n = idx + 1
        const isOpen = expanded === w.id
        const isCurrent = idx === 0
        const monthlyLockedByWeek = monthlyLocks[idx] ?? null
        return (
          <div
            key={w.id}
            className="rounded-xl border"
            style={{
              background: 'var(--surface-3)',
              borderColor: 'var(--panel-border)',
            }}
          >
            <div className="flex items-center gap-3 pl-4 pr-2 py-3">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : w.id)}
                className="flex items-center gap-4 flex-1 text-left hover:opacity-90 transition"
              >
                <div className="w-12 text-center shrink-0">
                  <div className="text-[11px] leading-tight" style={{ color: 'var(--text-dim)' }}>주차</div>
                  <div
                    className="text-xl font-extrabold tabular-nums leading-tight"
                    style={{ color: 'var(--text-emphasis)' }}
                  >
                    {n}
                  </div>
                </div>
                {startDate && (
                  <div
                    className="text-sm tabular-nums w-24 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {formatRange(getWeekRange(startDate, n))}
                  </div>
                )}

                <div className="flex-1 flex items-center gap-2">
                  {bosses.map((b) => (
                    <BossAvatar key={b.key} boss={b} imageBase={imageBase} difficulty={w.config.bosses[b.key]?.difficulty} size={40} />
                  ))}
                  {monthlyBoss && (
                    <BossAvatar
                      boss={monthlyBoss}
                      imageBase={imageBase}
                      difficulty={monthlyLockedByWeek != null ? 'none' : w.config.blackMage?.difficulty}
                      size={40}
                    />
                  )}
                </div>

                {(() => {
                  const weeklySum = calcWeeklySum(w.config, bosses)
                  const monthlySum = !monthlyBoss || monthlyLockedByWeek != null
                    ? 0
                    : bossEarn(monthlyBoss, w.config.blackMage)
                  return (
                    <div className="text-right shrink-0 pr-1 tabular-nums leading-tight">
                      <div className="text-base font-bold" style={{ color: 'var(--accent-bright)' }}>+{weeklySum}</div>
                      {monthlySum > 0 && (
                        <div className="text-sm font-semibold" style={{ color: 'var(--warning-text-bright)' }}>+{monthlySum}</div>
                      )}
                    </div>
                  )
                })()}

                <svg
                  width="16" height="16" viewBox="0 0 12 12" fill="none"
                  className={`transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--text-dim)' }}
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => removeWeek(w.id)}
                disabled={weeks.length <= 1}
                title={weeks.length <= 1 ? '최소 한 주차는 유지되어야 합니다' : '이 주차 삭제'}
                className="shrink-0 w-8 h-8 rounded-md hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)] disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
                style={{ color: 'var(--text-dim)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="editor"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                  }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="border-t px-3 py-3"
                    style={{
                      borderColor: 'var(--row-divider)',
                      background: 'var(--skeleton-bg)',
                    }}
                  >
                    <WeekEditor
                      config={w.config}
                      onChange={(c) => updateWeek(w.id, c)}
                      isCurrent={isCurrent}
                      monthlyLockedByWeek={monthlyLockedByWeek}
                      bosses={bosses}
                      monthlyBoss={monthlyBoss}
                      imageBase={imageBase}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addWeek}
        className="w-full rounded-xl border border-dashed py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:border-[var(--selected-border)] hover:text-[var(--accent-bright)]"
        style={{
          borderColor: 'var(--dashed-border)',
          color: 'var(--text-dim)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        주차 추가
      </button>
    </div>
  )
}
