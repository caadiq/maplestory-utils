import Select from '../../../../components/common/Select'
import { calcPoints } from '../../data'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))
const NONE_DIFFICULTY = { key: 'none', label: '격파 불가', points: 0 }
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

// 모바일: 보스 1개를 세로 카드로 (윗줄: 이미지·이름·완료 / 아랫줄: 난이도·파티)
export default function BossRow({ boss, sel = DEFAULT_SEL, onChange, imageBase, monthly = false, showDone = true, passMult = 1 }) {
  const disabled = sel.difficulty === 'none'
  const difficultyOptions = [NONE_DIFFICULTY, ...boss.difficulties]
    .map((d) => ({ value: d.key, label: diffLabel(d, sel.party, passMult) }))

  return (
    <div
      className="rounded-xl border p-2.5 space-y-2"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
    >
      <div className="flex items-center gap-2">
        <img src={`${imageBase}/${boss.image}`} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
        <span className="text-sm font-semibold flex-1 truncate">
          {boss.name}
          {monthly && <span className="ml-1.5 text-[11px] font-medium" style={{ color: 'var(--warning-text)' }}>월간</span>}
        </span>
        {showDone && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ done: !sel.done })}
            className="shrink-0 w-16 rounded-full h-8 text-xs font-bold"
            style={disabled ? {
              boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-dim)',
            } : sel.done ? {
              background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), 0 2px 5px rgba(31,44,61,.2)',
              color: '#ffffff',
            } : {
              background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)',
              color: '#5c6b7a',
            }}
          >
            {sel.done ? '완료' : '미완료'}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <Select
            value={sel.difficulty}
            onChange={(v) => {
              if (v === 'none') onChange({ difficulty: 'none', done: false })
              else onChange({ difficulty: v })
            }}
            options={difficultyOptions}
          />
        </div>
        <div className="w-20 shrink-0">
          <Select
            value={sel.party}
            onChange={(v) => onChange({ party: v })}
            options={PARTY_OPTIONS}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
