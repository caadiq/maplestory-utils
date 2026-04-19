import { memo, useMemo } from 'react'
import Select from '../../../../components/common/Select'
import Tooltip from '../../../../components/common/Tooltip'
import { useSymbolStore } from '../../store'
import { formatMesoKorean } from '../../../../utils/formatting'
import { formatKoreanDate, computeCompletion, eventBonusForType } from '../../utils'

const INPUT_CLASS = "w-full h-10 rounded-md border px-3 text-base text-right tabular-nums outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)] disabled:opacity-50"
const INPUT_STYLE = {
  background: 'var(--input-bg)',
  borderColor: 'var(--input-border)',
  color: 'var(--text-strong)',
}

function SymbolCard({ symbol, equipped, charId }) {
  const progress = useSymbolStore((s) => s.progress?.[charId]?.[symbol.id])
  const updateSymbol = useSymbolStore((s) => s.updateSymbol)
  const eventSkill = useSymbolStore((s) => s.characters.find((c) => c.id === charId)?.event_skill)

  const dailyDone = progress?.dailyDone ?? false
  const weeklyCount = progress?.weeklyCount ?? 3
  const baseDefault = symbol.daily_default ?? 0
  const eventBonus = eventBonusForType(eventSkill, symbol.type)
  const hasDailyOverride = progress?.daily !== undefined
  const daily = hasDailyOverride ? progress.daily : baseDefault + eventBonus
  const extra = progress?.extra ?? 0
  const patch = (p) => charId && updateSymbol(charId, symbol.id, p)
  const dailyTooltip = !hasDailyOverride && eventBonus > 0 && eventSkill
    ? `기본 ${baseDefault} + 보약 ${eventBonus} (${eventSkill.skill_name} Lv.${eventSkill.skill_level})`
    : null

  const level = progress?.level ?? 0
  const growth = progress?.growth ?? 0
  const requireGrowth = symbol.levels?.find((l) => l.level === level)?.required_count || 0
  const isMax = equipped && level >= symbol.max_level

  const { remainingSymbols, remainingMeso, arrearMeso } = useMemo(() => {
    if (!equipped || !symbol.levels?.length) return { remainingSymbols: 0, remainingMeso: 0, arrearMeso: 0 }
    let sym = 0, meso = 0, arr = 0
    let arrLv = level, arrG = growth
    while (arrLv < symbol.max_level) {
      const req = symbol.levels.find((l) => l.level === arrLv)?.required_count
      const cost = symbol.levels.find((l) => l.level === arrLv)?.meso_cost
      if (req == null || cost == null || arrG < req) break
      arr += cost
      arrG -= req
      arrLv += 1
    }
    let g = growth
    for (const l of symbol.levels) {
      if (l.level < level) continue
      sym += Math.max(l.required_count - g, 0)
      g = Math.max(g - l.required_count, 0)
      meso += l.meso_cost
    }
    return { remainingSymbols: sym, remainingMeso: meso, arrearMeso: arr }
  }, [equipped, level, growth, symbol.levels, symbol.max_level])

  const reachableLevel = useMemo(() => {
    if (!equipped || isMax) return level
    let lv = level
    let g = growth
    while (lv < symbol.max_level) {
      const req = symbol.levels?.find((l) => l.level === lv)?.required_count
      if (!req || g < req) break
      g -= req
      lv += 1
    }
    return lv
  }, [equipped, isMax, level, growth, symbol.levels, symbol.max_level])

  const effectivelyMax = equipped && !isMax && reachableLevel >= symbol.max_level
  const interactable = equipped && !isMax && !effectivelyMax

  const { days: daysLeft, date: completeDate } = useMemo(() => {
    if (!equipped || isMax) return { days: null, date: null }
    return computeCompletion({
      remainingSymbols,
      daily,
      weeklyPerWeek: (weeklyCount || 0) * (symbol.weekly_default || 0),
      extra,
      dailyDone,
    })
  }, [equipped, isMax, remainingSymbols, daily, weeklyCount, symbol.weekly_default, extra, dailyDone])

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
        opacity: equipped ? 1 : 0.6,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-14 h-14 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: 'var(--surface-nested)' }}
        >
          {symbol.image_url && (
            <img
              src={symbol.image_url}
              alt={symbol.region}
              className={`w-12 h-12 object-contain ${!equipped ? 'grayscale opacity-50' : ''}`}
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">{symbol.region}</div>
          <div className="text-sm tabular-nums mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Lv.<span className="font-bold text-base" style={{ color: 'var(--accent-bright)' }}>{level}</span>
            <span style={{ color: 'var(--text-dim)' }}> / {symbol.max_level}</span>
          </div>
        </div>
        {equipped && !isMax && !effectivelyMax && (
          <button
            type="button"
            onClick={() => patch({ dailyDone: !dailyDone })}
            title="오늘 일퀘 완료 여부"
            className="shrink-0 rounded-md h-8 px-3 text-xs font-semibold border disabled:opacity-40 disabled:cursor-not-allowed"
            style={dailyDone ? {
              background: 'var(--selected-bg)',
              borderColor: 'var(--selected-border)',
              color: 'var(--accent-bright)',
            } : {
              background: 'var(--danger-bg-hover)',
              borderColor: 'var(--icon-danger-border)',
              color: 'var(--danger-text)',
            }}
          >
            {dailyDone ? '금일 일퀘 완료' : '금일 일퀘 미완료'}
          </button>
        )}
      </div>

      {/* 진행도 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm tabular-nums mb-1.5">
          {isMax ? (
            <span style={{ color: 'var(--text-muted)' }}>
              성장치 <span className="font-bold" style={{ color: 'var(--warning-text-bright)' }}>MAX</span>
            </span>
          ) : effectivelyMax ? (
            <Tooltip text={`Lv.${symbol.max_level}까지 상승 가능`}>
              <span style={{ color: 'var(--text-muted)' }}>
                성장치 {growth} <span className="font-bold" style={{ color: 'var(--warning-text-bright)' }}>(MAX)</span> / {requireGrowth}
              </span>
            </Tooltip>
          ) : reachableLevel > level ? (
            <Tooltip text={`Lv.${reachableLevel}까지 상승 가능`}>
              <span style={{ color: 'var(--text-muted)' }}>
                성장치 {growth} / {requireGrowth}
              </span>
            </Tooltip>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              성장치 {growth} / {requireGrowth}
            </span>
          )}
          {!isMax && !effectivelyMax && (
            <span style={{ color: 'var(--text-muted)' }}>
              {requireGrowth ? Math.min(Math.floor((growth / requireGrowth) * 100), 100) : 0}%
            </span>
          )}
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
          <div
            className="h-full transition-all"
            style={{
              width: isMax || effectivelyMax ? '100%' : `${Math.min((growth / requireGrowth) * 100, 100)}%`,
              background: isMax || effectivelyMax ? 'var(--progress-amber)' : 'var(--progress-emerald)',
            }}
          />
        </div>
      </div>

      {/* 획득량 입력 */}
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: symbol.weekly_default > 0 ? '0.7fr 1.3fr 1fr' : '1fr 1fr' }}
      >
        <div className="space-y-1">
          <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>일퀘 획득</label>
          <input
            type="text"
            inputMode="numeric"
            value={equipped ? String(daily) : '0'}
            onChange={(e) => patch({ daily: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
            disabled={!interactable}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            {...(dailyTooltip ? { title: dailyTooltip } : {})}
          />
        </div>
        {symbol.weekly_default > 0 && (
          <div className="space-y-1">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>주간퀘 획득</label>
            <Select
              value={weeklyCount}
              onChange={(v) => patch({ weeklyCount: v })}
              options={[0, 1, 2, 3].map((n) => ({
                value: n,
                label: `${n * symbol.weekly_default}개`,
              }))}
              disabled={!interactable}
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>추가 심볼</label>
          <input
            type="text"
            inputMode="numeric"
            value={equipped ? String(extra) : '0'}
            onChange={(e) => patch({ extra: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
            disabled={!interactable}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </div>
      </div>

      {/* 정보 */}
      <div className="text-base">
        {[
          { label: '남은 심볼', value: equipped && !isMax && !effectivelyMax ? `${remainingSymbols.toLocaleString()}개` : '-', color: 'var(--text-emphasis)' },
          { label: '필요 메소', value: equipped && !isMax ? remainingMeso.toLocaleString() : '-', color: 'var(--warning-text-bright)', tooltip: equipped && !isMax ? formatMesoKorean(remainingMeso) : null },
          { label: '체납 메소', value: equipped && !isMax ? arrearMeso.toLocaleString() : '-', color: 'var(--danger-text)', tooltip: equipped && !isMax ? formatMesoKorean(arrearMeso) : null },
          { label: '남은 일수', value: equipped && !isMax && !effectivelyMax && daysLeft != null ? `${daysLeft.toLocaleString()}일` : '-', color: 'var(--text-emphasis)' },
          { label: '예상 완료일', value: equipped && !isMax && !effectivelyMax && completeDate ? formatKoreanDate(completeDate) : '-', color: equipped && !isMax && !effectivelyMax && completeDate ? 'var(--accent-bright)' : 'var(--text-dim)', strong: true },
        ].map((row) => (
          <div
            key={row.label}
            className="flex justify-between py-2 border-t first:border-t-0"
            style={{ borderColor: 'var(--row-divider)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            {row.tooltip ? (
              <Tooltip text={row.tooltip}>
                <span className={`tabular-nums ${row.strong ? 'font-semibold' : 'font-medium'}`} style={{ color: row.color }}>
                  {row.value}
                </span>
              </Tooltip>
            ) : (
              <span className={`tabular-nums ${row.strong ? 'font-semibold' : 'font-medium'}`} style={{ color: row.color }}>
                {row.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(SymbolCard)
