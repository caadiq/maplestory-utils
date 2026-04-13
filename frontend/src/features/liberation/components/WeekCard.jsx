import Select from '../../../components/Select'
import Checkbox from '../../../components/Checkbox'
import Tooltip from '../../../components/Tooltip'
import { WEEKLY_BOSSES, MONTHLY_BOSSES, BOSS_IMAGE_BASE, calcPoints, formatDate } from '../data'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))

/**
 * week: { startDate, bosses: { [bossKey]: { enabled, difficulty, party } }, includeBlackMage: {enabled, difficulty, party} }
 */
export default function WeekCard({ weekNumber, weekData, cumulativePoints, currentChapter, chapterInfo, onChange, weekProgress }) {
  const totalThisWeek = weekProgress.points
  const updateBoss = (bossKey, patch) => {
    const nextBosses = { ...weekData.bosses, [bossKey]: { ...weekData.bosses[bossKey], ...patch } }
    onChange({ ...weekData, bosses: nextBosses })
  }

  const updateBlackMage = (patch) => {
    onChange({ ...weekData, blackMage: { ...weekData.blackMage, ...patch } })
  }

  return (
    <div className="rounded-xl border border-white/5 bg-gray-900/40 overflow-hidden">
      {/* 헤더: 주차 번호 + 날짜 + 이번 주 획득 + 누적 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-950/60 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">{weekNumber}주차</div>
          <div className="text-xs text-gray-500">{formatDate(weekData.startDate)}</div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-gray-400">
            획득 <span className="text-emerald-300 font-semibold tabular-nums">+{totalThisWeek}</span>
          </div>
          <div className="text-gray-400">
            누적 <span className="text-white font-semibold tabular-nums">{cumulativePoints}</span>
          </div>
          {chapterInfo && (
            <div className="text-xs text-gray-500">
              {chapterInfo.name} {chapterInfo.current}/{chapterInfo.required}
            </div>
          )}
        </div>
      </div>

      {/* 보스 그리드 */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {WEEKLY_BOSSES.map((boss) => {
          const sel = weekData.bosses[boss.key] || { enabled: false, difficulty: boss.difficulties[0].key, party: 1 }
          const diff = boss.difficulties.find((d) => d.key === sel.difficulty) || boss.difficulties[0]
          const earned = sel.enabled ? calcPoints(diff.points, sel.party) : 0

          return (
            <div key={boss.key} className={`rounded-lg border p-2 transition ${sel.enabled ? 'border-white/10 bg-gray-950/40' : 'border-white/5 bg-transparent opacity-60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={sel.enabled}
                  onChange={(v) => updateBoss(boss.key, { enabled: v })}
                  size="sm"
                />
                <Tooltip text={boss.name}>
                  <img src={`${BOSS_IMAGE_BASE}/${boss.image}`} alt={boss.name} className="w-7 h-7 rounded object-cover" />
                </Tooltip>
                <span className="text-xs font-medium truncate flex-1">{boss.name}</span>
                {earned > 0 && (
                  <span className="text-xs text-emerald-300 font-semibold tabular-nums">+{earned}</span>
                )}
              </div>
              {sel.enabled && (
                <div className="flex gap-1.5">
                  <Select
                    value={sel.difficulty}
                    onChange={(v) => updateBoss(boss.key, { difficulty: v })}
                    options={boss.difficulties.map((d) => ({ value: d.key, label: `${d.label} +${d.points}` }))}
                    className="flex-1"
                  />
                  <Select
                    value={sel.party}
                    onChange={(v) => updateBoss(boss.key, { party: v })}
                    options={PARTY_OPTIONS}
                    className="w-16"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* 검은 마법사 (월 1회) */}
        {MONTHLY_BOSSES.map((boss) => {
          const sel = weekData.blackMage || { enabled: false, difficulty: boss.difficulties[0].key, party: 1 }
          const diff = boss.difficulties.find((d) => d.key === sel.difficulty) || boss.difficulties[0]
          const earned = sel.enabled ? calcPoints(diff.points, sel.party) : 0

          return (
            <div key={boss.key} className={`rounded-lg border p-2 transition col-span-2 sm:col-span-2 ${
              sel.enabled ? 'border-amber-500/40 bg-amber-500/[0.05]' : 'border-white/5 bg-transparent opacity-60'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={sel.enabled}
                  onChange={(v) => updateBlackMage({ enabled: v })}
                  size="sm"
                />
                <Tooltip text={`${boss.name} (월 1회)`}>
                  <img src={`${BOSS_IMAGE_BASE}/${boss.image}`} alt={boss.name} className="w-7 h-7 rounded object-cover" />
                </Tooltip>
                <span className="text-xs font-medium flex-1">{boss.name} <span className="text-[10px] text-amber-400">월간</span></span>
                {earned > 0 && (
                  <span className="text-xs text-emerald-300 font-semibold tabular-nums">+{earned}</span>
                )}
              </div>
              {sel.enabled && (
                <div className="flex gap-1.5">
                  <Select
                    value={sel.difficulty}
                    onChange={(v) => updateBlackMage({ difficulty: v })}
                    options={boss.difficulties.map((d) => ({ value: d.key, label: `${d.label} +${d.points}` }))}
                    className="flex-1"
                  />
                  <Select
                    value={sel.party}
                    onChange={(v) => updateBlackMage({ party: v })}
                    options={PARTY_OPTIONS}
                    className="w-16"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
