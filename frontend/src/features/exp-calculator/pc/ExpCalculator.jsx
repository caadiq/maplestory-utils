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
 * 경험치 계산기 — "지금 이걸 몇 개 쓰면 얼마나 오르나".
 *
 * 예측(도달일)은 하지 않는다. 일회성 아이템을 언제 쓸지 알 수 없어 예측이 흔들렸다.
 *
 * 보너스(보약·아티팩트)는 **캐릭터를 골랐을 때만** 반영한다 —
 * 보약은 서버·캐릭터마다 찍은 단계가 달라서 레벨만으로는 정할 수 없다.
 * 레벨만 입력하면 보너스 없는 기본값을 본다.
 */

const LEVELS = Array.from({ length: 100 }, (_, i) => ({ value: 200 + i, label: `Lv.${200 + i}` }))
const STORE_KEY = 'maple.exp.state'

const loadState = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {} } catch { return {} }
}
const saveState = (s) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch { /* 저장 실패 무시 */ }
}

export default function ExpCalculator() {
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
  const setCount = (key, v) => setCounts((c) => ({ ...c, [key]: v }))
  const clearAll = () => setCounts({})

  const detach = () => {
    setCharacter(null)
    setBonus(null)
  }

  return (
    <MapleWindow
      title="EXP CALCULATOR"
      className="max-w-[1180px] mx-auto"
      titleRight={need ? (
        <span className="text-[12.5px] font-bold" style={{ color: '#cfdae4' }}>
          Lv.{level} 필요 경험치 {formatExp(need)}
        </span>
      ) : null}
    >
      <div className="flex flex-col gap-3">
        {/* 기준 — 캐릭터 / 레벨 / 보너스 */}
        <div className="rounded-[11px] overflow-hidden" style={CARD}>
          <SecTitle>기준</SecTitle>
          <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
            <div className="relative" ref={addAnchorRef}>
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input
                  value={addName}
                  onChange={(e) => { setAddName(e.target.value); setDropdownOpen(true) }}
                  placeholder="캐릭터 닉네임 (선택)"
                  className="w-[200px] rounded-lg border px-3 py-2 text-[13.5px] outline-none"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
                />
                <button
                  type="submit"
                  disabled={searchMutation.isPending}
                  className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
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
              <span className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--mpl-row)' }}>
                {character.world_icon && <img src={character.world_icon} alt="" className="w-4 h-4" style={{ imageRendering: 'pixelated' }} />}
                <b className="text-[13.5px]" style={{ color: 'var(--text-strong)' }}>{character.character_name}</b>
                <span className="text-[12.5px]" style={{ color: 'var(--text-dim)' }}>Lv.{character.character_level}</span>
                <button type="button" onClick={detach} title="캐릭터 해제" className="text-[12px] font-bold px-1" style={{ color: 'var(--text-dim)' }}>✕</button>
              </span>
            )}

            <span className="flex items-center gap-2">
              <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>레벨</span>
              <div className="w-[110px]">
                <Select options={LEVELS} value={level} onChange={setLevel} />
              </div>
            </span>

            <span className="flex items-center gap-2">
              <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>에픽던전 단계</span>
              <Seg options={EPIC_STAGES} value={epicStage} onChange={setEpicStage} />
            </span>

            {addError && (
              <span className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{addError}</span>
            )}
          </div>

          <BonusBar character={character} bonus={bonus} />
        </div>

        {/* 항목 */}
        {groups.map(([group, list]) => (
          <div key={group} className="rounded-[11px] overflow-hidden" style={CARD}>
            <SecTitle>{group}</SecTitle>
            <div className="px-2 py-1">
              {list.map((it) => (
                <ItemRow
                  key={it.key}
                  item={it}
                  need={need}
                  count={counts[it.key] || 0}
                  onCount={(v) => setCount(it.key, v)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 합계 */}
        <div
          className="rounded-[11px] px-5 py-4 flex items-center justify-between gap-6 flex-wrap sticky bottom-3"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
            boxShadow: '0 6px 18px rgba(31,44,61,.3)',
          }}
        >
          <span className="flex items-center gap-3">
            <span className="text-[13px] font-extrabold" style={{ color: '#cfdae4' }}>합계</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[12px] font-bold rounded px-2 py-1"
              style={{ background: 'rgba(255,255,255,.14)', color: '#e8f0f7' }}
            >
              전부 지우기
            </button>
          </span>
          <span className="flex items-baseline gap-4 flex-wrap">
            <b className="text-[22px] font-extrabold tabular-nums" style={{ color: '#ffffff' }}>{formatExp(result.total)}</b>
            <b className="text-[20px] font-extrabold tabular-nums" style={{ color: 'var(--mpl-title-yellow)' }}>{formatPct(result.pct)}</b>
            {result.levels >= 1 && (
              <span className="text-[13px] font-bold" style={{ color: '#cfdae4' }}>≈ {result.levels.toFixed(2)}레벨</span>
            )}
          </span>
        </div>
      </div>
    </MapleWindow>
  )
}

/**
 * 적용 중인 보너스 — 어디에 얼마가 붙는지 보여준다.
 * 값이 스킬 텍스트에서 읽은 것이라, 게임과 대조할 수 있게 출처(스킬 이름)까지 남긴다.
 */
function BonusBar({ character, bonus }) {
  if (!character) {
    return (
      <div className="px-4 py-2.5 text-[12.5px] border-t" style={{ borderColor: 'var(--mpl-card-line)', color: 'var(--text-dim)' }}>
        캐릭터를 조회하면 그 캐릭터의 <b style={{ color: 'var(--text-muted)' }}>보약·아티팩트 경험치 보너스</b>가 반영됩니다.
        지금은 보너스 없는 기본값입니다.
      </div>
    )
  }
  if (!bonus) {
    return (
      <div className="px-4 py-2.5 text-[12.5px] border-t" style={{ borderColor: 'var(--mpl-card-line)', color: 'var(--text-dim)' }}>
        이 캐릭터에서 경험치 보너스를 찾지 못했습니다 — 기본값으로 계산합니다.
      </div>
    )
  }
  const chips = [
    ['몬스터파크', bonus.monsterPark],
    ['에픽던전', bonus.epicDungeon],
    ['아케인 일퀘', bonus.arcaneDaily],
    ['그란디스 일퀘', bonus.grandisDaily],
  ].filter(([, v]) => v > 0)

  return (
    <div className="px-4 py-2.5 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--mpl-card-line)' }}>
      <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-muted)' }}>적용 중인 보너스</span>
      {chips.map(([name, v]) => (
        <span key={name} className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(94,205,245,.16)', color: 'var(--mpl-sky-to)' }}>
          {name} +{v}%
        </span>
      ))}
      {bonus.hunting > 0 && (
        <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}
          title="사냥으로 얻는 경험치에만 붙습니다 — 아래 항목에는 반영하지 않습니다">
          사냥 +{bonus.hunting}% (미반영)
        </span>
      )}
      <span className="text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
        {bonus.sources?.map((s) => s.skill_name).join(' · ')}
      </span>
    </div>
  )
}

/** 항목 한 줄 — 1회(1개)당 값과 개수 입력, 그리고 그 줄의 합계 */
function ItemRow({ item, need, count, onCount }) {
  const eachPct = need && item.each != null ? (item.each / need) * 100 : 0
  const sum = item.each != null ? item.each * (count || 0) : null
  const dim = item.locked || item.each == null

  return (
    <div
      className="flex items-center gap-3 px-2 py-2 border-b last:border-b-0"
      style={{ borderColor: 'var(--mpl-card-line)', opacity: dim ? 0.45 : 1 }}
    >
      <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg overflow-hidden" style={{ background: 'var(--surface-nested)' }}>
        {item.icon
          ? <img src={item.icon} alt="" className="w-full h-full object-contain" draggable={false} />
          : <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>?</span>}
      </span>

      <span className="w-[190px] shrink-0 min-w-0">
        <b className="block truncate text-[13.5px]" style={{ color: 'var(--text-strong)' }}>{item.name}</b>
        {(item.locked || item.note) && (
          <span className="block text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
            {item.locked ? `Lv.${item.minLevel} 이상` : item.note}
          </span>
        )}
      </span>

      <span className="w-[150px] shrink-0 text-right tabular-nums text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {item.each == null ? '—' : formatExp(item.each)}
      </span>
      <span className="w-[74px] shrink-0 text-right tabular-nums text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
        {item.each == null ? '' : formatPct(eachPct)}
      </span>
      {item.bonusPct > 0 && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(94,205,245,.16)', color: 'var(--mpl-sky-to)' }}>
          +{item.bonusPct}%
        </span>
      )}

      <span className="ml-auto flex items-center gap-3">
        {sum > 0 && (
          <span className="text-right tabular-nums">
            <b className="block text-[13.5px]" style={{ color: 'var(--text-strong)' }}>{formatExp(sum)}</b>
            <span className="block text-[11.5px]" style={{ color: 'var(--mpl-sky-to)' }}>{formatPct((sum / need) * 100)}</span>
          </span>
        )}
        <NumInput
          value={count}
          onChange={onCount}
          min={0}
          max={9999}
          chars={3}
          unit={item.unit}
        />
      </span>
    </div>
  )
}
