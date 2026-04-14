import { useState } from 'react'
import { LIBERATION_BOSS_IMAGE_BASE, WEEKLY_BOSSES, MONTHLY_BOSSES } from '../data'
import { BossRow } from './WeeklyDefault'

const DIFF_BADGE = {
  easy: { label: 'E', color: '#22c55e', border: 'rgba(34,197,94,0.4)', bg: 'rgba(34,197,94,0.15)' },
  normal: { label: 'N', color: '#60a5fa', border: 'rgba(96,165,250,0.4)', bg: 'rgba(96,165,250,0.15)' },
  hard: { label: 'H', color: '#f87171', border: 'rgba(248,113,113,0.4)', bg: 'rgba(248,113,113,0.15)' },
  chaos: { label: 'C', color: '#c084fc', border: 'rgba(192,132,252,0.45)', bg: 'rgba(192,132,252,0.15)' },
  extreme: { label: 'X', color: '#f59e0b', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.2)' },
}

// 임시 목업 데이터
const MOCK_WEEKS = [
  { n: 1, date: '4/14 - 4/16', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: true, earn: 1070, cumulative: 1070, current: true },
  { n: 2, date: '4/16 - 4/23', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 1540 },
  { n: 3, date: '4/23 - 4/30', diffs: { lotus: 'hard', damien: 'hard', lucid: 'normal', will: 'normal', dusk: 'normal', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 315, cumulative: 1855, custom: true },
  { n: 4, date: '4/30 - 5/7', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: true, earn: 1070, cumulative: 2925 },
  { n: 5, date: '5/7 - 5/14', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 3395 },
  { n: 6, date: '5/14 - 5/21', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 3865 },
  { n: 7, date: '5/21 - 5/28', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 4335 },
  { n: 8, date: '5/28 - 6/4', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: true, earn: 1070, cumulative: 5405 },
  { n: 9, date: '6/4 - 6/11', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 5875 },
  { n: 10, date: '6/11 - 6/18', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 6345 },
  { n: 11, date: '6/18 - 6/25', diffs: { lotus: 'hard', damien: 'hard', lucid: 'hard', will: 'hard', dusk: 'chaos', jinhilla: 'hard', darknell: 'hard' }, monthly: false, earn: 470, cumulative: 6500 },
]

function BossAvatar({ boss, difficulty, size = 40 }) {
  const badge = DIFF_BADGE[difficulty]
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rounded-md overflow-hidden bg-gray-900 border border-white/5"
        style={{ width: size, height: size }}
      >
        <img src={`${LIBERATION_BOSS_IMAGE_BASE}/${boss.image}`} alt={boss.name} className="w-full h-full object-cover" />
      </div>
      {badge && (
        <div
          className="text-[10px] font-bold leading-none rounded flex items-center justify-center border"
          style={{ width: 16, height: 16, color: badge.color, background: badge.bg, borderColor: badge.border }}
        >
          {badge.label}
        </div>
      )}
    </div>
  )
}

// 주차 편집 영역 (실제 state 바인딩은 이후 연결)
function WeekEditor({ week, monthlyAlreadyAssigned }) {
  const initial = () => {
    const bosses = {}
    WEEKLY_BOSSES.forEach((b) => {
      bosses[b.key] = { difficulty: week.diffs[b.key] || 'none', party: 1 }
    })
    return { bosses, blackMage: { difficulty: week.monthly ? 'hard' : 'none', party: 1 } }
  }
  const [config, setConfig] = useState(initial)

  const updateBoss = (key, patch) => {
    setConfig((prev) => ({ ...prev, bosses: { ...prev.bosses, [key]: { ...prev.bosses[key], ...patch } } }))
  }
  const updateBlackMage = (patch) => {
    if (monthlyAlreadyAssigned) return
    setConfig((prev) => ({ ...prev, blackMage: { ...prev.blackMage, ...patch } }))
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-white/5">
        {WEEKLY_BOSSES.map((boss) => (
          <BossRow
            key={boss.key}
            boss={boss}
            sel={config.bosses[boss.key]}
            onChange={(patch) => updateBoss(boss.key, patch)}
            showDone={week.current}
          />
        ))}
        {/* 검은 마법사는 항상 표시, 같은 달에 다른 주차에 이미 배정된 경우 비활성 */}
        <div className={monthlyAlreadyAssigned ? 'opacity-40 pointer-events-none' : ''}>
          <BossRow
            boss={MONTHLY_BOSSES[0]}
            sel={monthlyAlreadyAssigned ? { difficulty: 'none', party: 1 } : config.blackMage}
            onChange={updateBlackMage}
            monthly
            showDone={week.current}
          />
        </div>
        {monthlyAlreadyAssigned && (
          <div className="text-[11px] text-amber-400/80 px-3 py-2">
            이번 달 검은 마법사는 다른 주차에 배정되어 있습니다.
          </div>
        )}
      </div>
      {week.custom && (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            기본 설정으로 되돌리기
          </button>
        </div>
      )}
    </div>
  )
}

export default function WeeklyDesignMocks() {
  const [expanded, setExpanded] = useState(3)

  return (
    <div className="space-y-2">
      {MOCK_WEEKS.map((w) => (
        <div
          key={w.n}
          className={`rounded-xl border transition ${
            w.custom ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-white/5 bg-gray-950/30'
          }`}
        >
          <button
            type="button"
            onClick={() => setExpanded(expanded === w.n ? null : w.n)}
            className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition text-left"
          >
            <div className="w-12 text-center shrink-0">
              <div className="text-[11px] text-gray-500 leading-tight">주차</div>
              <div className={`text-xl font-extrabold tabular-nums leading-tight ${w.custom ? 'text-emerald-300' : 'text-gray-200'}`}>
                {w.n}
              </div>
            </div>
            <div className="text-sm text-gray-400 tabular-nums w-24 shrink-0">{w.date}</div>

            <div className="flex-1 flex items-center gap-2">
              {WEEKLY_BOSSES.map((b) => (
                <BossAvatar key={b.key} boss={b} difficulty={w.diffs[b.key]} size={40} />
              ))}
              {w.monthly && (
                <BossAvatar boss={MONTHLY_BOSSES[0]} difficulty="hard" size={40} />
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-emerald-300 tabular-nums leading-tight">+{w.earn}</div>
              <div className="text-[11px] text-gray-500 tabular-nums">누적 {w.cumulative.toLocaleString()}</div>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 12 12" fill="none"
              className={`text-gray-500 transition-transform shrink-0 ${expanded === w.n ? 'rotate-180' : ''}`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {expanded === w.n && (
            <div className="border-t border-white/5 px-3 py-3 bg-gray-950/30">
              <WeekEditor week={w} monthlyAlreadyAssigned={!w.monthly} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
