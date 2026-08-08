import { memo, useMemo } from 'react'
import Select from '../../../../components/common/Select'
import Tooltip from '../../../../components/common/Tooltip'
import { useSymbolStore } from '../../store'
import { formatMeso } from '../../../../utils/formatting'
import { formatKoreanDate } from '../../utils'
import { symbolMetrics } from '../../logic'

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
  const artifact = useSymbolStore((s) => s.characters.find((c) => c.id === charId)?.artifact)

  const metrics = useMemo(
    () => symbolMetrics({ symbol, progress, equipped, eventSkill, artifact }),
    [symbol, progress, equipped, eventSkill, artifact],
  )
  const {
    dailyDone, weeklyCount, baseDefault, eventBonus, artifactBonus, hasDailyOverride, daily, extra,
    level, growth, requireGrowth, isMax,
    remainingMeso, arrearMeso, reachableLevel, effectivelyMax, interactable,
    remainingAfterExtra, daysLeft, completeDate,
  } = metrics

  const patch = (p) => charId && updateSymbol(charId, symbol.id, p)
  const dailyTooltip = !hasDailyOverride && (eventBonus > 0 || artifactBonus > 0)
    ? [
        `기본 ${baseDefault}`,
        eventBonus > 0 && eventSkill ? `보약 ${eventBonus} (${eventSkill.skill_name} Lv.${eventSkill.skill_level})` : null,
        artifactBonus > 0 ? `아티팩트 ${artifactBonus}` : null,
      ].filter(Boolean).join(' + ')
    : null

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
          className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
          style={{
            background: equipped
              ? 'linear-gradient(180deg, #8f9fe0, #7583cf)'
              : 'var(--surface-nested)',
            boxShadow: equipped ? 'inset 0 1px 0 rgba(255,255,255,.4)' : 'none',
          }}
        >
          {symbol.image_url && (
            <img
              src={symbol.image_url}
              alt={symbol.region}
              className={`${symbol.type === '아케인' ? 'w-9 h-9' : 'w-11 h-11'} object-contain ${!equipped ? 'grayscale opacity-50' : ''}`}
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
            title="금일 일일 퀘스트 완료 여부"
            className="shrink-0 rounded-full h-8 px-3.5 text-xs font-semibold"
            style={dailyDone ? {
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
            {dailyDone ? '금일 일퀘 완료' : '금일 일퀘 미완료'}
          </button>
        )}
      </div>

      {/* 진행도 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm tabular-nums mb-1.5">
          {isMax ? (
            <span style={{ color: 'var(--text-muted)' }}>
              성장치 <span className="font-bold" style={{ color: 'var(--progress-red)' }}>MAX</span>
            </span>
          ) : effectivelyMax ? (
            <Tooltip text={`Lv.${symbol.max_level}까지 상승 가능`}>
              <span style={{ color: 'var(--text-muted)' }}>
                성장치 {growth} <span className="font-bold" style={{ color: 'var(--progress-amber)' }}>(MAX)</span> / {requireGrowth}
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
              background: isMax
                ? 'linear-gradient(180deg, #ffd76e, #f0a828)'
                : effectivelyMax
                  ? 'var(--progress-amber)'
                  : 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
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
          { label: '남은 심볼', value: equipped && !isMax && !effectivelyMax ? `${remainingAfterExtra.toLocaleString()}개` : '-', color: 'var(--text-emphasis)' },
          { label: '필요 메소', value: equipped && !isMax ? remainingMeso.toLocaleString() : '-', color: 'var(--warning-text-bright)', tooltip: equipped && !isMax ? formatMeso(remainingMeso) : null },
          { label: '체납 메소', value: equipped && !isMax ? arrearMeso.toLocaleString() : '-', color: 'var(--danger-text)', tooltip: equipped && !isMax ? formatMeso(arrearMeso) : null },
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
