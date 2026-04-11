import { useState } from 'react'
import { api } from '../../api/client'

const DIFF_KEYS = { '이지': 'easy', '노말': 'normal', '하드': 'hard', '카오스': 'chaos', '익스트림': 'extreme' }
const DIFF_COLORS = {
  '이지': 'text-green-400 border-green-400/30 bg-green-400/10',
  '노말': 'text-gray-300 border-gray-500/30 bg-gray-500/10',
  '하드': 'text-rose-400 border-rose-400/30 bg-rose-400/10',
  '카오스': 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  '익스트림': 'text-red-500 border-red-500/30 bg-red-500/10',
}

const DUMMY_BOSSES = [
  {
    id: 1, name: '자쿰', imgId: 1,
    difficulties: [
      { name: '이지', crystal: 6_612_500, maxParty: 1 },
      { name: '노말', crystal: 16_200_000, maxParty: 1 },
      { name: '카오스', crystal: 81_000_000, maxParty: 1 },
    ],
  },
  {
    id: 2, name: '힐라', imgId: 3,
    difficulties: [
      { name: '노말', crystal: 6_612_500, maxParty: 1 },
      { name: '하드', crystal: 56_250_000, maxParty: 1 },
    ],
  },
  {
    id: 3, name: '매그너스', imgId: 10,
    difficulties: [
      { name: '이지', crystal: 7_200_000, maxParty: 1 },
      { name: '노말', crystal: 19_012_500, maxParty: 1 },
      { name: '하드', crystal: 95_062_500, maxParty: 1 },
    ],
  },
  {
    id: 4, name: '파풀라투스', imgId: 22,
    difficulties: [
      { name: '이지', crystal: 4_012_500, maxParty: 1 },
      { name: '노말', crystal: 13_012_500, maxParty: 1 },
      { name: '카오스', crystal: 79_012_500, maxParty: 1 },
    ],
  },
  {
    id: 5, name: '듄켈', imgId: 27,
    difficulties: [
      { name: '노말', crystal: 92_450_000, maxParty: 1 },
      { name: '하드', crystal: 231_125_000, maxParty: 6 },
    ],
  },
  {
    id: 6, name: '림보', imgId: 33,
    difficulties: [
      { name: '노말', crystal: 140_000_000, maxParty: 1 },
      { name: '하드', crystal: 350_000_000, maxParty: 6 },
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

/* ── 좌측: 캐릭터 패널 ── */
function CharacterPanel({ characters, selectedChar, onSelect, onAdd, onRemove }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await api(`/api/characters/search?name=${encodeURIComponent(name.trim())}`)
      onAdd(data)
      setName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">1. 캐릭터 등록</h2>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="닉네임 입력"
          className="flex-1 min-w-0 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 transition"
        />
        <button type="submit" disabled={loading} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition shrink-0">
          {loading ? '...' : '등록'}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-1">
        {characters.map((char) => (
          <div
            key={char.character_name}
            onClick={() => onSelect(char.character_name)}
            className={`flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition group ${
              selectedChar === char.character_name
                ? 'bg-emerald-500/10 border border-emerald-500/50'
                : 'hover:bg-gray-800/50 border border-transparent'
            }`}
          >
            {char.character_image && (
              <img src={char.character_image} alt="" className="w-10 h-10 rounded bg-gray-800" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{char.character_name}</div>
              <div className="text-xs text-gray-500">Lv.{char.character_level} {char.job_name}</div>
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); onRemove(char.character_name) }}
              className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition cursor-pointer text-lg"
            >
              ×
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 중앙: 보스 선택 패널 ── */
function BossPanel({ selectedChar, selections, onChange }) {
  if (!selectedChar) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        캐릭터를 선택해주세요
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">2. 보스 선택</h2>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        {/* 헤더 */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-gray-900/80 text-xs text-gray-500 border-b border-gray-800">
          <div>보스</div>
          <div>난이도</div>
          <div>파티원 수</div>
          <div className="text-right">수익</div>
        </div>

        {/* 보스 행 */}
        <div className="divide-y divide-gray-800/50">
          {DUMMY_BOSSES.map((boss) => {
            // 현재 캐릭터에서 이 보스의 선택된 난이도 찾기
            const selectedDiffIdx = boss.difficulties.findIndex((_, i) => {
              const key = `${boss.id}-${i}`
              return selections[key]?.enabled
            })
            const sel = selectedDiffIdx >= 0 ? selections[`${boss.id}-${selectedDiffIdx}`] : null
            const diff = selectedDiffIdx >= 0 ? boss.difficulties[selectedDiffIdx] : null
            const isSelected = !!sel?.enabled

            return (
              <div key={boss.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-3 py-2 items-center transition ${isSelected ? '' : 'opacity-40'}`}>
                {/* 보스 이름 + 아이콘 */}
                <div className="flex items-center gap-2">
                  <img src={`/boss-images/icon/${boss.imgId}.png`} alt={boss.name} className="w-8 h-8 rounded object-cover shrink-0" />
                  <span className="text-sm font-medium truncate">{boss.name}</span>
                </div>

                {/* 난이도 선택 */}
                <div className="flex flex-wrap gap-1">
                  {boss.difficulties.map((d, i) => {
                    const key = `${boss.id}-${i}`
                    const active = selections[key]?.enabled
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          // 라디오 방식: 같은 보스에서 하나만 선택
                          const newSelections = { ...selections }
                          boss.difficulties.forEach((_, j) => {
                            const k = `${boss.id}-${j}`
                            if (j === i) {
                              newSelections[k] = { enabled: !active, party: active ? d.maxParty : (selections[k]?.party || d.maxParty) }
                            } else {
                              newSelections[k] = { ...newSelections[k], enabled: false }
                            }
                          })
                          onChange(newSelections)
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition ${
                          active ? DIFF_COLORS[d.name] : 'text-gray-600 border-gray-700/50 hover:border-gray-600'
                        }`}
                      >
                        {d.name}
                      </button>
                    )
                  })}
                </div>

                {/* 파티원 수 */}
                <div>
                  {isSelected && (
                    <select
                      value={sel.party}
                      onChange={(e) => {
                        const key = `${boss.id}-${selectedDiffIdx}`
                        onChange({ ...selections, [key]: { ...sel, party: Number(e.target.value) } })
                      }}
                      className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-300 outline-none"
                    >
                      {Array.from({ length: diff.maxParty }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}인</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 수익 */}
                <div className={`text-right text-sm font-medium ${isSelected ? 'text-green-400' : ''}`}>
                  {isSelected ? formatMeso(Math.floor(diff.crystal / sel.party)) : '-'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── 우측: 결과 패널 ── */
function ResultPanel({ characters, allSelections }) {
  let totalCrystals = 0
  let totalRevenue = 0

  const charResults = characters.map((char) => {
    const charSel = allSelections[char.character_name] || {}
    let crystals = 0
    let revenue = 0

    Object.entries(charSel).forEach(([key, sel]) => {
      if (!sel.enabled) return
      const [bossId, diffIdx] = key.split('-').map(Number)
      const boss = DUMMY_BOSSES.find((b) => b.id === bossId)
      if (!boss) return
      crystals++
      revenue += Math.floor(boss.difficulties[diffIdx].crystal / sel.party)
    })

    totalCrystals += crystals
    totalRevenue += revenue

    return { name: char.character_name, crystals, revenue }
  })

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">3. 결과</h2>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-4">
        {/* 합산 */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-sm text-gray-400">보유 결정석</span>
            <div className="text-2xl font-bold">{totalCrystals}<span className="text-gray-500 text-base">/90</span></div>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-400">총 수익</span>
            <div className="text-2xl font-bold text-green-400">{formatMeso(totalRevenue)}</div>
            <div className="text-xs text-gray-500">메소</div>
          </div>
        </div>

        {/* 결정석 게이지 */}
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min((totalCrystals / 90) * 100, 100)}%` }}
          />
        </div>

        {/* 캐릭터별 소계 */}
        {charResults.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-gray-800">
            <div className="text-xs text-gray-500 mb-2">캐릭터별</div>
            {charResults.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{r.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{r.crystals}/12</span>
                  <span className={r.revenue > 0 ? 'text-green-400' : 'text-gray-600'}>{r.revenue > 0 ? formatMeso(r.revenue) : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 메인 ── */
export default function BossPage() {
  const [characters, setCharacters] = useState(() => {
    const saved = localStorage.getItem('maple-characters')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedChar, setSelectedChar] = useState(null)
  const [allSelections, setAllSelections] = useState(() => {
    const saved = localStorage.getItem('maple-boss-selections')
    return saved ? JSON.parse(saved) : {}
  })

  const saveCharacters = (chars) => {
    setCharacters(chars)
    localStorage.setItem('maple-characters', JSON.stringify(chars))
  }

  const saveSelections = (sels) => {
    setAllSelections(sels)
    localStorage.setItem('maple-boss-selections', JSON.stringify(sels))
  }

  const handleAddCharacter = (charData) => {
    if (characters.find((c) => c.character_name === charData.character_name)) return
    saveCharacters([...characters, charData])
    setSelectedChar(charData.character_name)
  }

  const handleRemoveCharacter = (name) => {
    saveCharacters(characters.filter((c) => c.character_name !== name))
    if (selectedChar === name) setSelectedChar(null)
    const newSelections = { ...allSelections }
    delete newSelections[name]
    saveSelections(newSelections)
  }

  const handleBossChange = (charSelections) => {
    if (!selectedChar) return
    saveSelections({ ...allSelections, [selectedChar]: charSelections })
  }

  const currentSelections = selectedChar ? (allSelections[selectedChar] || {}) : {}

  return (
    <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[240px_1fr_280px] lg:gap-6">
      {/* 좌측 */}
      <div className="lg:border-r lg:border-gray-800 lg:pr-6">
        <CharacterPanel
          characters={characters}
          selectedChar={selectedChar}
          onSelect={setSelectedChar}
          onAdd={handleAddCharacter}
          onRemove={handleRemoveCharacter}
        />
      </div>

      {/* 중앙 */}
      <div className="min-w-0">
        <BossPanel
          selectedChar={selectedChar}
          selections={currentSelections}
          onChange={handleBossChange}
        />
      </div>

      {/* 우측 */}
      <div className="lg:border-l lg:border-gray-800 lg:pl-6">
        <ResultPanel
          characters={characters}
          allSelections={allSelections}
        />
      </div>
    </div>
  )
}
