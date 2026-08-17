import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import { useCharacterRoster } from '../../../hooks/useCharacterRoster'
import { CARD, NumInput, Seg, SecTitle } from '../../../components/common/widgets'
import { buildItems, summarize, formatExp, formatPct, levelExp, EPIC_STAGES } from '../logic'

/**
 * 경험치 계산기 — 모바일.
 * PC와 같은 로직·규칙을 세로 한 열로 배치한다 (1회당 값 → 개수 → 줄 합계).
 */

const LEVELS = Array.from({ length: 100 }, (_, i) => ({ value: 200 + i, label: `Lv.${200 + i}` }))
const STORE_KEY = 'maple.exp.state'

const loadState = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {} } catch { return {} }
}
const saveState = (s) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch { /* 저장 실패 무시 */ }
}

export default function MobileExpCalculator() {
  const saved = useMemo(() => loadState(), [])
  const [character, setCharacter] = useState(saved.character ?? null)
  const [bonus, setBonus] = useState(saved.bonus ?? null)
  const [level, setLevel] = useState(saved.level ?? 260)
  const [epicStage, setEpicStage] = useState(saved.epicStage ?? 2)
  const [counts, setCounts] = useState(saved.counts ?? {})

  useEffect(() => {
    saveState({ character, bonus, level, epicStage, counts })
  }, [character, bonus, level, epicStage, counts])

  const { data } = useQuery({
    queryKey: ['exp', 'data'],
    queryFn: () => api('/api/exp/data'),
    staleTime: Infinity,
  })

  const {
    addName, setAddName, addError, dropdownOpen, setDropdownOpen,
    addAnchorRef, searchMutation, handleSearch,
  } = useCharacterRoster({
    endpoint: (name) => `/api/exp/lookup?name=${encodeURIComponent(name)}`,
    onResult: (res) => {
      setCharacter(res.character)
      setBonus(res.bonus)
      setLevel(res.character.character_level)
    },
  })

  const items = useMemo(
    () => buildItems(data, level, character ? bonus : null, { epicStage }),
    [data, level, character, bonus, epicStage],
  )
  const result = useMemo(() => summarize(items, counts, data, level), [items, counts, data, level])
  const groups = useMemo(() => {
    const map = new Map()
    for (const it of items) {
      if (!map.has(it.group)) map.set(it.group, [])
      map.get(it.group).push(it)
    }
    return [...map]
  }, [items])

  const need = levelExp(data, level)

  return (
    <MapleWindow title="EXP CALCULATOR" className="mpl-page-enter">
      <div className="flex flex-col gap-2.5 pb-24">
        <div className="rounded-[11px] overflow-hidden" style={CARD}>
          <SecTitle>기준</SecTitle>
          <div className="px-3 py-3 flex flex-col gap-2.5">
            <div className="relative" ref={addAnchorRef}>
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input
                  value={addName}
                  onChange={(e) => { setAddName(e.target.value); setDropdownOpen(true) }}
                  placeholder="캐릭터 닉네임 (선택)"
                  className="flex-1 min-w-0 rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
                />
                <button
                  type="submit"
                  disabled={searchMutation.isPending}
                  className="rounded-lg px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50 shrink-0"
                  style={{ background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))' }}
                >
                  조회
                </button>
              </form>
              <CharacterSuggestDropdown
                anchorRef={addAnchorRef}
                filter={addName}
                open={dropdownOpen}
                onSelect={(n) => { setAddName(n); setDropdownOpen(false); searchMutation.mutate(n) }}
              />
            </div>

            {character && (
              <span className="flex items-center gap-2 rounded-lg px-2.5 py-2 self-start" style={{ background: 'var(--mpl-row)' }}>
                {character.world_icon && <img src={character.world_icon} alt="" className="w-4 h-4" style={{ imageRendering: 'pixelated' }} />}
                <b className="text-[14px]" style={{ color: 'var(--text-strong)' }}>{character.character_name}</b>
                <span className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Lv.{character.character_level}</span>
                <button
                  type="button"
                  onClick={() => { setCharacter(null); setBonus(null) }}
                  className="text-[13px] font-bold px-1"
                  style={{ color: 'var(--text-dim)' }}
                >
                  ✕
                </button>
              </span>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold w-[64px] shrink-0" style={{ color: 'var(--text-muted)' }}>레벨</span>
              <div className="flex-1">
                <Select options={LEVELS} value={level} onChange={setLevel} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold w-[64px] shrink-0" style={{ color: 'var(--text-muted)' }}>에픽던전</span>
              <Seg options={EPIC_STAGES} value={epicStage} onChange={setEpicStage} />
            </div>

            {addError && <span className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{addError}</span>}
          </div>
          <BonusBar character={character} bonus={bonus} />
        </div>

        {groups.map(([group, list]) => (
          <div key={group} className="rounded-[11px] overflow-hidden" style={CARD}>
            <SecTitle>{group}</SecTitle>
            <div className="px-2">
              {list.map((it) => (
                <ItemRow
                  key={it.key}
                  item={it}
                  need={need}
                  count={counts[it.key] || 0}
                  onCount={(v) => setCounts((c) => ({ ...c, [it.key]: v }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 합계 — 스크롤과 무관하게 아래에 붙여 둔다 */}
      <div
        className="fixed left-0 right-0 bottom-0 z-30 px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
          boxShadow: '0 -4px 14px rgba(31,44,61,.28)',
        }}
      >
        <button
          type="button"
          onClick={() => setCounts({})}
          className="text-[12.5px] font-bold rounded px-2.5 py-1.5 shrink-0"
          style={{ background: 'rgba(255,255,255,.14)', color: '#e8f0f7' }}
        >
          지우기
        </button>
        <span className="flex items-baseline gap-2.5 min-w-0">
          <b className="text-[17px] font-extrabold tabular-nums truncate" style={{ color: '#fff' }}>{formatExp(result.total)}</b>
          <b className="text-[16px] font-extrabold tabular-nums shrink-0" style={{ color: 'var(--mpl-title-yellow)' }}>{formatPct(result.pct)}</b>
        </span>
      </div>
    </MapleWindow>
  )
}

function BonusBar({ character, bonus }) {
  if (!character) {
    return (
      <div className="px-3 py-2.5 text-[12.5px] border-t" style={{ borderColor: 'var(--mpl-card-line)', color: 'var(--text-dim)' }}>
        캐릭터를 조회하면 <b style={{ color: 'var(--text-muted)' }}>보약·아티팩트 보너스</b>가 반영됩니다.
      </div>
    )
  }
  if (!bonus) {
    return (
      <div className="px-3 py-2.5 text-[12.5px] border-t" style={{ borderColor: 'var(--mpl-card-line)', color: 'var(--text-dim)' }}>
        경험치 보너스를 찾지 못했습니다 — 기본값으로 계산합니다.
      </div>
    )
  }
  const chips = [
    ['몬파', bonus.monsterPark],
    ['에픽던전', bonus.epicDungeon],
    ['아케인 일퀘', bonus.arcaneDaily],
    ['그란디스 일퀘', bonus.grandisDaily],
  ].filter(([, v]) => v > 0)
  return (
    <div className="px-3 py-2.5 border-t flex items-center gap-1.5 flex-wrap" style={{ borderColor: 'var(--mpl-card-line)' }}>
      {chips.map(([name, v]) => (
        <span key={name} className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(94,205,245,.16)', color: 'var(--mpl-sky-to)' }}>
          {name} +{v}%
        </span>
      ))}
    </div>
  )
}

function ItemRow({ item, need, count, onCount }) {
  const eachPct = need && item.each != null ? (item.each / need) * 100 : 0
  const sum = item.each != null ? item.each * (count || 0) : null
  const dim = item.locked || item.each == null

  return (
    <div
      className="flex items-center gap-2.5 py-2 border-b last:border-b-0"
      style={{ borderColor: 'var(--mpl-card-line)', opacity: dim ? 0.45 : 1 }}
    >
      <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg overflow-hidden" style={{ background: 'var(--surface-nested)' }}>
        {item.icon && <img src={item.icon} alt="" className="w-full h-full object-contain" draggable={false} />}
      </span>
      <span className="flex-1 min-w-0">
        <b className="block truncate text-[13.5px]" style={{ color: 'var(--text-strong)' }}>{item.name}</b>
        <span className="block text-[12px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
          {item.each == null ? (item.note || '—') : `${formatExp(item.each)} · ${formatPct(eachPct)}`}
          {item.bonusPct > 0 && <b style={{ color: 'var(--mpl-sky-to)' }}> +{item.bonusPct}%</b>}
          {item.locked && ` · Lv.${item.minLevel} 이상`}
        </span>
        {sum > 0 && (
          <span className="block text-[12px] font-bold tabular-nums" style={{ color: 'var(--mpl-sky-to)' }}>
            = {formatExp(sum)} · {formatPct((sum / need) * 100)}
          </span>
        )}
      </span>
      <NumInput value={count} onChange={onCount} min={0} max={9999} chars={3} unit={item.unit} />
    </div>
  )
}
