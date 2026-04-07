import { useState } from 'react'

const DIFF_KEYS = { '이지': 'easy', '노말': 'normal', '하드': 'hard', '카오스': 'chaos', '익스트림': 'extreme' }

const DUMMY_BOSSES = [
  {
    id: 1, name: '자쿰', imgId: 1,
    difficulties: [
      { name: '이지', crystal: 6_612_500, defaultParty: 1 },
      { name: '노말', crystal: 16_200_000, defaultParty: 1 },
      { name: '카오스', crystal: 81_000_000, defaultParty: 1 },
    ],
  },
  {
    id: 2, name: '힐라', imgId: 3,
    difficulties: [
      { name: '노말', crystal: 6_612_500, defaultParty: 1 },
      { name: '하드', crystal: 56_250_000, defaultParty: 1 },
    ],
  },
  {
    id: 3, name: '매그너스', imgId: 10,
    difficulties: [
      { name: '이지', crystal: 7_200_000, defaultParty: 1 },
      { name: '노말', crystal: 19_012_500, defaultParty: 1 },
      { name: '하드', crystal: 95_062_500, defaultParty: 1 },
    ],
  },
  {
    id: 4, name: '파풀라투스', imgId: 22,
    difficulties: [
      { name: '이지', crystal: 4_012_500, defaultParty: 1 },
      { name: '노말', crystal: 13_012_500, defaultParty: 1 },
      { name: '카오스', crystal: 79_012_500, defaultParty: 1 },
    ],
  },
  {
    id: 5, name: '듄켈', imgId: 27,
    difficulties: [
      { name: '노말', crystal: 92_450_000, defaultParty: 1 },
      { name: '하드', crystal: 231_125_000, defaultParty: 6 },
    ],
  },
  {
    id: 6, name: '림보', imgId: 33,
    difficulties: [
      { name: '노말', crystal: 140_000_000, defaultParty: 1 },
      { name: '하드', crystal: 350_000_000, defaultParty: 6 },
    ],
  },
]

function formatMeso(n) {
  if (n >= 100_000_000) {
    const uk = Math.floor(n / 100_000_000)
    const man = Math.floor((n % 100_000_000) / 10_000)
    return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function BossRowList({ boss, selections, onChange }) {
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 bg-gray-900 px-3 py-2">
        <img src={`/boss-images/icon/${boss.imgId}.png`} alt={boss.name} className="w-10 h-10 rounded object-cover" />
        <span className="font-medium">{boss.name}</span>
      </div>
      <div className="divide-y divide-gray-800/50">
        {boss.difficulties.map((diff, i) => {
          const key = `${boss.id}-${i}`
          const sel = selections[key] || { enabled: false, party: diff.defaultParty }
          return (
            <label key={i} className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition ${sel.enabled ? '' : 'opacity-50'}`}>
              <input type="checkbox" checked={sel.enabled} onChange={(e) => onChange(key, { ...sel, enabled: e.target.checked })} className="accent-emerald-500 w-4 h-4 shrink-0" />
              <img src={`/boss-images/diff-badge/${DIFF_KEYS[diff.name]}.png`} alt={diff.name} className="h-5 shrink-0" />
              <div className="flex-1 text-sm text-gray-400">{formatMeso(diff.crystal)}</div>
              <select value={sel.party} onChange={(e) => { e.stopPropagation(); onChange(key, { ...sel, party: Number(e.target.value) }) }} className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-300 outline-none w-14 shrink-0" onClick={(e) => e.stopPropagation()}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>÷{n}인</option>)}
              </select>
              <div className={`text-sm font-medium w-20 text-right shrink-0 ${sel.enabled ? 'text-green-400' : 'text-gray-600'}`}>
                {sel.enabled ? formatMeso(Math.floor(diff.crystal / sel.party)) : '-'}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default function BossPage() {
  const [selections, setSelections] = useState({})

  const handleChange = (key, sel) => setSelections((prev) => ({ ...prev, [key]: sel }))

  const entries = Object.entries(selections).filter(([, s]) => s.enabled)
  const totalCrystals = entries.length
  const totalRevenue = entries.reduce((sum, [key, sel]) => {
    const [bossId, diffIdx] = key.split('-').map(Number)
    const boss = DUMMY_BOSSES.find((b) => b.id === bossId)
    return sum + Math.floor(boss.difficulties[diffIdx].crystal / sel.party)
  }, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주간 보스 수익 계산기</h1>

      <div className="flex gap-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <div>
          <div className="text-xs text-gray-500">결정석</div>
          <div className="text-lg font-bold">{totalCrystals}<span className="text-gray-500 text-sm">/12</span></div>
        </div>
        <div>
          <div className="text-xs text-gray-500">예상 수익</div>
          <div className="text-lg font-bold text-green-400">{formatMeso(totalRevenue)} <span className="text-sm text-gray-400">메소</span></div>
        </div>
      </div>

      <div className="space-y-3">
        {DUMMY_BOSSES.map((boss) => (
          <BossRowList key={boss.id} boss={boss} selections={selections} onChange={handleChange} />
        ))}
      </div>
    </div>
  )
}
