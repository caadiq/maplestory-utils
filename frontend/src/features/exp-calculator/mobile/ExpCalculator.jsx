import { useState, useMemo, useEffect, createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import CharacterChip from '../../../components/common/CharacterChip'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useCharacterLookup } from '../../../hooks/useCharacterLookup'
import { useCharacterRoster } from '../../../hooks/useCharacterRoster'
import { useExpStore, expInitialState } from '../store'
import { NumInput, DecimalInput } from '../../../components/common/widgets'
import {
  EPIC_STAGES, defaultSettings, zoneOn,
  breakdown, fmtPct, weekKeyKST, parkSpecialActive,
} from '../logic'

/**
 * 경험치 계산기 — 모바일.
 *
 * PC의 3열 카드를 한 열로 펴고, 카드 사이에 일일/주간/일회성 구분선을 넣는다.
 * 계산·아이콘·저장은 전부 PC와 공유(logic/store)하고 배치와 크기만 다르다.
 */

const SKY = 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))'
const PUR = 'linear-gradient(180deg, var(--mpl-purple-from), var(--mpl-purple-to))'
const TAN = 'linear-gradient(180deg, #e6c976, #c8a34e)'
const QUEST = 'linear-gradient(180deg,#7cc7ea,#4da4d4)'
const C_DAY = 'var(--accent-bright)'
const C_WEEK = '#9247c9'
const C_ONCE = '#e8a20c'

const EPIC_ICON = { high_mountain: 'ed_highmountain', angler_company: 'ed_angler', nightmare_paradise: 'ed_nightmare' }
const PARK_ICON_PREFIX = {
  yeoro: 'arc', chewchew: 'arc', lacheln: 'arc', arcana: 'arc', morass: 'arc', esfera: 'arc',
  moonbridge: 'ten', maze: 'ten', limen: 'ten', sellas: 'mp',
  cernium: 'gra', arcs: 'gra', odium: 'gra', dowonkyung: 'gra', arteria: 'gra', carcion: 'gra', tallahart: 'gra',
}
const parkIconId = (id) => `${PARK_ICON_PREFIX[id]}_${id}`

/* ── 소품 (PC와 같은 문법, 모바일 치수) ── */

const IconCtx = createContext({})

function Ico({ id, size = 34 }) {
  const url = useContext(IconCtx)[id]
  return url
    ? <img src={url} alt="" className="object-contain shrink-0" style={{ width: size, height: size, imageRendering: 'pixelated' }} />
    : null
}

function MiniToggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="relative w-[33px] h-[21px] rounded-full shrink-0 transition-colors"
      style={{ background: on ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' : 'var(--toggle-off, #c3ced9)' }}>
      <span className="absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white transition-all"
        style={{ left: on ? 15 : 3, boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
    </button>
  )
}

/** 컨텐츠 카드 — 헤더(아이콘·제목·스위치) + 본문 + 맨 아래 합계 줄 */
function Card({ icon, grad, title, sub, pct, pctColor, totalLabel = '합계', toggle, onToggle, children }) {
  const off = toggle === false
  return (
    <div className="rounded-2xl border p-3.5"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
      <div className={`flex items-center gap-2.5 ${children ? 'mb-2.5' : ''}`}>
        <div className="w-[46px] h-[46px] rounded-xl shrink-0 flex items-center justify-center"
          style={{ background: grad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)', opacity: off ? 0.45 : 1 }}>
          <Ico id={icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold truncate">{title}</div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        {toggle != null && <MiniToggle on={toggle} onChange={onToggle} />}
      </div>
      {children}
      <div className="flex items-center justify-between pt-2 mt-2.5 border-t" style={{ borderColor: 'var(--row-divider)' }}>
        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{totalLabel}</span>
        <span className="text-[15.5px] font-bold tabular-nums" style={{ color: off ? 'var(--text-dim)' : pctColor }}>{pct}</span>
      </div>
    </div>
  )
}

/** 일퀘 지역 한 줄 — 스위치 + 지역 아이콘 + 이름 + 기여도 */
function ZoneRow({ icon, label, on, onToggle, value, color }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-t first:border-t-0 text-[13px]"
      style={{ borderColor: 'var(--row-divider)' }}>
      <MiniToggle on={on} onChange={onToggle} />
      <Ico id={icon} size={21} />
      <span className="truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="ml-auto tabular-nums font-medium shrink-0" style={{ color }}>{value}</span>
    </div>
  )
}

/** 2줄 행 — 윗줄: 아이콘 + 이름 + 입력 / 아랫줄: 단가 + 결과값 */
function TwoLineRow({ icon, label, control, note, value, valueColor, locked }) {
  return (
    <div className={`pt-2 border-t first:border-t-0 first:pt-0 ${locked ? 'opacity-45' : ''}`}
      style={{ borderColor: 'var(--row-divider)' }}>
      <div className="flex items-center gap-3">
        <Ico id={icon} size={22} />
        <span className="text-[13px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {!locked && <span className="ml-auto shrink-0">{control}</span>}
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{note}</span>
        <span className="text-[13px] tabular-nums font-medium" style={{ color: locked ? 'var(--text-dim)' : valueColor }}>
          {locked ? '—' : value}
        </span>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <span className="block text-[12.5px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

/** 칸을 꽉 채우는 숫자 입력 (그리드 안에서 폭을 맞춘다) */
const FULL_INPUT_CLASS = 'w-full h-[38px] rounded-md border px-3 text-[14.5px] text-right tabular-nums outline-none focus:border-[var(--input-border-focus)]'
const FULL_INPUT_STYLE = { background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }

/** 칸을 꽉 채우는 숫자 입력 (그리드 안에서 폭을 맞춘다) */
function FullInput({ value, onChange, decimal, max }) {
  if (decimal) {
    return (
      <DecimalInput value={value} onChange={onChange} max={max}
        className={FULL_INPUT_CLASS} style={FULL_INPUT_STYLE} />
    )
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={String(value ?? 0)}
      onChange={(e) => onChange(Math.min(parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0, max))}
      className={FULL_INPUT_CLASS}
      style={FULL_INPUT_STYLE}
    />
  )
}

function SegFull({ options, value, onChange }) {
  return (
    <div className="flex w-full h-[38px] rounded-md overflow-hidden border text-[12.5px] font-bold"
      style={{ borderColor: 'var(--input-border)' }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className="flex-1 min-w-0 whitespace-nowrap"
          style={o.value === value
            ? { background: SKY, color: '#fff' }
            : { background: 'var(--input-bg)', color: 'var(--text-muted)' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 카드 묶음 구분선 — 일일 / 주간 / 일회성 */
function SecLabel({ children }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5 pt-1">
      <span className="text-[12.5px] font-bold tracking-wide" style={{ color: 'var(--text-muted)' }}>{children}</span>
      <i className="flex-1 h-px" style={{ background: 'var(--panel-border)' }} />
    </div>
  )
}


const LEVEL_OPTIONS = Array.from({ length: 100 }, (_, i) => ({ value: 200 + i, label: `Lv.${200 + i}` }))

/** 적용 중인 보너스 — 스킬 효과에서 읽은 값이라 게임과 대조할 수 있게 그대로 보여준다 */
function BonusChips({ bonus }) {
  if (!bonus) return null
  const chips = [
    ['몬파', bonus.monsterPark],
    ['에픽던전', bonus.epicDungeon],
    ['아케인 일퀘', bonus.arcaneDaily],
    ['그란디스 일퀘', bonus.grandisDaily],
  ].filter(([, v]) => v > 0)
  if (!chips.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {chips.map(([name, v]) => (
        <span
          key={name}
          className="text-[12px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(94,205,245,.16)', color: 'var(--mpl-sky-to)' }}
        >
          {name} +{v}%
        </span>
      ))}
    </div>
  )
}

export default function MobileExpCalculator() {
  const { hydrated } = useFeatureSync({ feature: 'exp-calculator', store: useExpStore, initial: expInitialState })
  const characters = useExpStore((s) => s.characters)
  const selectedName = useExpStore((s) => s.selectedName)
  const allSettings = useExpStore((s) => s.settings)
  const addCharacter = useExpStore((s) => s.addCharacter)
  const removeCharacter = useExpStore((s) => s.removeCharacter)
  const setCharacters = useExpStore((s) => s.setCharacters)
  const selectCharacter = useExpStore((s) => s.selectCharacter)
  const patchSettings = useExpStore((s) => s.patchSettings)

  const [confirmRemove, setConfirmRemove] = useState(null)
  /*
   * 기본값 보기의 레벨 (검색줄 드롭다운).
   * 캐릭터 보기의 레벨은 캐릭터 패널 드롭다운이 따로 정한다(설정에 저장) —
   * 두 보기가 각자 레벨을 기억해야 캐릭터를 추가한 뒤에도 기본값을 다시 볼 수 있다.
   */
  const [baseLevel, setBaseLevel] = useState(260)
  const {
    addName, setAddName, addError, setAddError,
    dropdownOpen, setDropdownOpen, addAnchorRef, searchMutation, handleSearch,
  } = useCharacterRoster({
    endpoint: (name) => `/api/exp/lookup?name=${encodeURIComponent(name)}`,
    onResult: (res) => { addCharacter({ ...res.character, exp_rate: res.exp_rate }) },
  })

  const { data } = useQuery({
    queryKey: ['exp', 'data'],
    queryFn: () => api('/api/exp/data'),
    staleTime: Infinity,
  })

  // 이번 주 스페셜 썬데이 여부 — 자동으로 켜지 않고 토글 옆에 힌트만 (PC와 동일)
  const { data: sunday } = useQuery({
    queryKey: ['sunday-maple', 'current'],
    queryFn: () => api('/api/sunday-maple/current'),
    staleTime: 30 * 60 * 1000,
  })
  const sundaySpecialWeek = sunday?.available && sunday.variant === 'special'

  const { data: lookup } = useCharacterLookup({
    queryKey: ['exp', 'lookup', selectedName],
    cacheKey: `maple.exp.data.${selectedName}`,
    endpoint: `/api/exp/lookup?name=${encodeURIComponent(selectedName)}`,
    enabled: hydrated && !!selectedName,
  })

  useEffect(() => {
    if (!lookup?.character) return
    setCharacters((chars) => chars.map((c) => (
      c.character_name === lookup.character.character_name
        ? { ...c, ...lookup.character, id: c.id, exp_rate: lookup.exp_rate }
        : c
    )))
  }, [lookup]) // eslint-disable-line react-hooks/exhaustive-deps

  const stored = characters.find((c) => c.character_name === selectedName) || null
  const fresh = lookup?.character?.character_name === selectedName ? lookup : null
  const char = useMemo(
    () => (stored && fresh
      ? { ...stored, ...fresh.character, id: stored.id, exp_rate: fresh.exp_rate }
      : stored),
    [stored, fresh],
  )

  const weekKey = weekKeyKST(new Date())
  /*
   * 입력값을 담는 칸. 캐릭터별로 따로 두되, 캐릭터를 안 고른 '기본값' 보기에도
   * 자기 칸이 있어야 개수를 넣을 수 있다.
   */
  const settingsId = char?.id ?? '__base__'
  const rawSettings = allSettings[settingsId] || defaultSettings(char?.character_level || 260)
  const s = useMemo(() => {
    const p = rawSettings.weekly.park
    const active = parkSpecialActive(p, weekKey)
    if (active === !!p.sundaySpecial) return rawSettings
    return { ...rawSettings, weekly: { ...rawSettings.weekly, park: { ...p, sundaySpecial: active } } }
  }, [rawSettings, weekKey])
  const patch = (p) => patchSettings(settingsId, p)
  const patchDeep = (key, p) => patch((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }))

  // 캐릭터 보기 — 패널에서 고른 레벨(기본은 현재 레벨) / 기본값 보기 — 검색줄 레벨
  const level = char ? (s.viewLevel || char.character_level) : baseLevel

  // 보약·아티팩트 보너스는 캐릭터를 골랐을 때만 반영한다 (서버·캐릭터마다 다르다)
  const bonus = char ? (fresh?.bonus ?? null) : null
  const bd = useMemo(() => (data ? breakdown(data, level, s, bonus) : null), [data, level, s, bonus])

  const icons = data?.icons || {}
  if (!hydrated || !data) return null

  const zoneGroups = [
    { key: 'arcane', title: '아케인리버 일일퀘스트', icon: 'arc_esfera' },
    { key: 'tenebris', title: '테네브리스 일일퀘스트', icon: 'ten_limen' },
    { key: 'grandis', title: '그란디스 일일퀘스트', icon: 'gra_carcion' },
  ]

  return (
    <IconCtx.Provider value={icons}>
      <MapleWindow title="EXP CALCULATOR" bodyClassName="space-y-2.5">

        {/* 캐릭터 */}
        <div className="rounded-2xl border p-3"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div ref={addAnchorRef} className="relative flex-1 min-w-0">
              <input
                type="text"
                value={addName}
                onChange={(e) => { setAddName(e.target.value); if (addError) setAddError('') }}
                onFocus={() => setDropdownOpen(true)}
                onClick={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder="캐릭터 닉네임 검색"
                className="w-full h-[42px] rounded-full border px-4 text-[13.5px] outline-none focus:border-[var(--input-border-focus)]"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
              />
              <CharacterSuggestDropdown
                open={dropdownOpen}
                filter={addName}
                anchorRef={addAnchorRef}
                excludeNames={characters.map((c) => c.character_name)}
                onSelect={(n) => { setAddName(n); setDropdownOpen(false); setAddError(''); searchMutation.mutate(n) }}
              />
            </div>
            <button type="submit" disabled={searchMutation.isPending}
              className="shrink-0 rounded-full px-5 h-[42px] text-[13.5px] font-bold disabled:opacity-50"
              style={{ background: SKY, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.3)' }}>
              {searchMutation.isPending ? '...' : '조회'}
            </button>
          </form>
          {addError && <p className="mt-2 text-[13px]" style={{ color: 'var(--danger-text)' }}>{addError}</p>}

          {/* 캐릭터 칩 — 다른 모바일 페이지와 같은 문법 */}
          {characters.length > 0 && (
            <div className="-mx-3 mt-2.5">
              <OverlayScrollbarsComponent
                options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
                defer
              >
                <div className="flex w-max gap-2.5 px-3 pt-0.5 pb-2">
                  {characters.map((c) => (
                    <CharacterChip
                      key={c.id || c.character_name}
                      char={c}
                      active={c.character_name === selectedName}
                      onSelect={() => selectCharacter(c.character_name)}
                      onRemove={() => setConfirmRemove(c)}
                    />
                  ))}
                </div>
              </OverlayScrollbarsComponent>
            </div>
          )}
          {characters.length === 0 && (
            <p className="py-6 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
              캐릭터를 조회하면 보약·아티팩트<br />보너스가 반영됩니다
            </p>
          )}

          {/* 기본값 보기 — 여기서 레벨을 고르면 캐릭터 선택이 풀리고 보너스 없는 값을 본다 */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[13px] font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>레벨 (기본값)</span>
            <div className="flex-1">
              <Select
                options={LEVEL_OPTIONS}
                value={char ? null : baseLevel}
                placeholder="선택"
                onChange={(v) => { setBaseLevel(v); selectCharacter(null) }}
              />
            </div>
          </div>
        </div>

        {/* 선택 캐릭터 — 이 패널의 레벨로 보약 포함 값을 본다 */}
        {char && (
          <div className="rounded-2xl border p-3.5"
            style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-center gap-1.5">
              {char.world_icon && <img src={char.world_icon} alt="" className="w-[19px] h-[19px] object-contain" style={{ imageRendering: 'pixelated' }} />}
              <span className="text-[16px] font-bold truncate">{char.character_name}</span>
              <span className="text-[12px] font-bold tabular-nums text-white px-2 py-0.5 rounded-md shrink-0" style={{ background: SKY }}>Lv.{char.character_level}</span>
              <span className="text-[12px] shrink-0" style={{ color: 'var(--text-muted)' }}>{char.job_name}</span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[13px] font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>레벨</span>
              <div className="flex-1">
                <Select options={LEVEL_OPTIONS} value={level} onChange={(v) => patch({ viewLevel: v })} />
              </div>
              {level !== char.character_level && (
                <button
                  type="button"
                  onClick={() => patch({ viewLevel: null })}
                  className="text-[12px] font-bold rounded-full px-2.5 py-1.5 shrink-0"
                  style={{ background: 'var(--mpl-row)', color: 'var(--text-muted)' }}
                >
                  현재 {char.character_level}
                </button>
              )}
            </div>
            <BonusChips bonus={bonus} />
          </div>
        )}

        {bd && (
          <>
            {/* ── 일일 ── */}
            <SecLabel>일일 컨텐츠</SecLabel>

            <Card icon="hunt" grad={PUR} title="사냥" sub="1소재 = 30분"
              pct={fmtPct(bd.hunt)} pctColor={C_WEEK} totalLabel="일일 합계">
              <div className="grid grid-cols-2 gap-2">
                <Field label="1소재당 획득 (%)">
                  <FullInput value={s.hunt.pctPerRun} decimal max={100} onChange={(v) => patchDeep('hunt', { pctPerRun: v })} />
                </Field>
                <Field label="하루 소재 수">
                  <FullInput value={s.hunt.runsPerDay} max={48} onChange={(v) => patchDeep('hunt', { runsPerDay: v })} />
                </Field>
              </div>
            </Card>

            {zoneGroups.map((g) => {
              const open = data.daily[g.key].filter((z) => level >= z.minLevel)
              const on = open.filter((z) => zoneOn(s.daily, z.id)).length
              return (
                <Card key={g.key} icon={g.icon} grad={QUEST} title={g.title}
                  sub={`${on}/${open.length} 지역 선택됨`} pct={fmtPct(bd.zones[`${g.key}Total`])} pctColor={C_DAY}>
                  <div>
                    {open.map((z) => {
                      const zb = bd.zones[z.id]
                      return (
                        <ZoneRow key={z.id}
                          icon={`${g.key === 'arcane' ? 'arc' : g.key === 'tenebris' ? 'ten' : 'gra'}_${z.id}`}
                          label={z.name}
                          on={zb.on}
                          onToggle={(v) => patch((prev) => ({ ...prev, daily: { ...prev.daily, [z.id]: v } }))}
                          value={fmtPct(zb.pct)}
                          color={zb.on ? C_DAY : 'var(--text-dim)'}
                        />
                      )
                    })}
                  </div>
                </Card>
              )
            })}

            {/* 몬파는 매일 도는 컨텐츠 — 일요일 보너스 때문에 주 단위로 계산해 하루 평균으로 보여준다 */}
            <Card icon="mp" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="몬스터파크"
              sub="일 2회 무료 · 최대 7회" pct={fmtPct(bd.park.total)} pctColor={C_WEEK} totalLabel="일 평균">
              <div className="grid grid-cols-[3fr_2fr] gap-2">
                <Field label="지역">
                  <Select
                    value={bd.park.zone?.id || ''}
                    onChange={(v) => patchDeep('weekly', { park: { ...s.weekly.park, zone: v } })}
                    options={data.monsterPark.zones.filter((z) => level >= z.minLevel)
                      .map((z) => ({ value: z.id, label: z.name, subIcon: icons[parkIconId(z.id)] })).reverse()}
                  />
                </Field>
                <Field label="일일 횟수">
                  <FullInput value={s.weekly.park.runs} max={7}
                    onChange={(v) => patchDeep('weekly', { park: { ...s.weekly.park, runs: v } })} />
                </Field>
              </div>
              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t text-[13px]" style={{ borderColor: 'var(--row-divider)' }}>
                <MiniToggle on={!!s.weekly.park.sundaySpecial}
                  onChange={(v) => patchDeep('weekly', { park: { ...s.weekly.park, sundaySpecial: v, sundaySpecialWeek: v ? weekKey : null } })} />
                <span style={{ color: 'var(--text-muted)' }}>스페셜 썬데이</span>
                {sundaySpecialWeek && <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>이번 주</span>}
                <span className="ml-auto tabular-nums font-medium"
                  style={{ color: s.weekly.park.sundaySpecial ? C_WEEK : 'var(--text-dim)' }}>
                  {s.weekly.park.sundaySpecial ? '일요일 400%' : '일요일 150%'}
                </span>
              </div>
            </Card>

            {/* ── 주간 ── */}
            <SecLabel>주간 컨텐츠</SecLabel>

            <Card icon="sauna" grad={PUR} title="리조트 · 사우나" sub="잠수 경험치"
              pct={fmtPct(bd.mvp + bd.vip)} pctColor={C_WEEK}>
              <div>
                <TwoLineRow icon="sauna" label="MVP 리조트" note={`1시간당 ${fmtPct(bd.saunaHourPct)}`}
                  control={<NumInput value={s.weekly.mvpHours} onChange={(v) => patchDeep('weekly', { mvpHours: v })} min={0} max={99} chars={3} unit="시간/주" />}
                  value={fmtPct(bd.mvp)} valueColor={C_WEEK} />
                <TwoLineRow icon="sauna_vip" label="VIP 사우나 이용권" note={`1개(30분)당 ${fmtPct(bd.vipOne)}`}
                  control={<NumInput value={s.items.vipTickets} onChange={(v) => patchDeep('items', { vipTickets: v })} min={0} max={999} chars={3} unit="개" />}
                  value={fmtPct(bd.vip)} valueColor={C_WEEK} />
              </div>
            </Card>

            <Card icon="mp_extreme" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="익스트림 몬스터파크"
              sub={bd.extreme.locked ? 'Lv.260 필요' : '주간 1회 · 목요일 초기화'}
              pct={fmtPct(bd.extreme.total)} pctColor={C_WEEK} totalLabel="주간 합계"
              toggle={!!s.weekly.extreme.on} onToggle={(v) => patchDeep('weekly', { extreme: { on: v } })} />

            <Card icon="ed_nightmare" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="에픽던전"
              sub="주간 1회 · 목요일 초기화" pct={fmtPct(bd.epic.total)} pctColor={C_WEEK} totalLabel="주간 합계"
              toggle={s.weekly.epic.on} onToggle={(v) => patchDeep('weekly', { epic: { ...s.weekly.epic, on: v } })}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="던전">
                  <Select
                    value={s.weekly.epic.dungeon}
                    onChange={(v) => patchDeep('weekly', { epic: { ...s.weekly.epic, dungeon: v } })}
                    options={data.epicDungeon.dungeons.map((d) => ({
                      value: d.id,
                      label: level >= d.minLevel ? d.name : `${d.name} (Lv.${d.minLevel})`,
                      subIcon: icons[EPIC_ICON[d.id]],
                    }))}
                  />
                </Field>
                <Field label="보상">
                  <SegFull options={EPIC_STAGES} value={s.weekly.epic.stage}
                    onChange={(v) => patchDeep('weekly', { epic: { ...s.weekly.epic, stage: v } })} />
                </Field>
              </div>
            </Card>

            {/* ── 일회성 ── */}
            <SecLabel>일회성 아이템</SecLabel>

            <Card icon="elixir" grad={TAN} title="성장의 비약" sub="일회성 소모"
              pct={fmtPct(bd.elixir + bd.e200 + bd.e250)} pctColor={C_ONCE}>
              <div>
                {data.elixirs.map((e) => (
                  <TwoLineRow key={e.id} icon={`elixir_${e.id}`} label={e.name} note={`1개당 ${fmtPct(bd.elixirOne[e.id])}`}
                    control={<NumInput value={s.items.elixirCounts?.[e.id] || 0}
                      onChange={(v) => patchDeep('items', { elixirCounts: { ...s.items.elixirCounts, [e.id]: v } })}
                      min={0} max={999} chars={3} unit="개" />}
                    value={fmtPct(bd.elixirEach[e.id])} valueColor={C_ONCE} />
                ))}
                <TwoLineRow icon="elixir200" label="200레벨 달성의 비약" note={`1개당 ${fmtPct(bd.e200One)}`}
                  control={<NumInput value={s.items.e200lv} onChange={(v) => patchDeep('items', { e200lv: v })} min={0} max={999} chars={3} unit="개" />}
                  value={fmtPct(bd.e200)} valueColor={C_ONCE} />
                <TwoLineRow icon="elixir250" label="250레벨 달성의 비약" note={`1개당 ${fmtPct(bd.e250One)}`}
                  control={<NumInput value={s.items.e250lv} onChange={(v) => patchDeep('items', { e250lv: v })} min={0} max={999} chars={3} unit="개" />}
                  value={fmtPct(bd.e250)} valueColor={C_ONCE} />
              </div>
            </Card>

            <Card icon="coupon" grad={TAN} title="EXP 교환권" sub="일회성 소모"
              pct={fmtPct(bd.couponN + bd.couponU)} pctColor={C_ONCE}>
              <div>
                <TwoLineRow icon="coupon" label="EXP 교환권" note={`1개당 ${fmtPct(bd.couponNOne)}`}
                  control={<NumInput value={s.items.couponNormal} onChange={(v) => patchDeep('items', { couponNormal: v })} min={0} max={99999} chars={5} unit="개" />}
                  value={fmtPct(bd.couponN)} valueColor={C_ONCE} />
                <TwoLineRow icon="coupon_up" label="상급 EXP 교환권" note={`1개당 ${fmtPct(bd.couponUOne)}`}
                  control={<NumInput value={s.items.couponUpper} onChange={(v) => patchDeep('items', { couponUpper: v })} min={0} max={99999} chars={5} unit="개" />}
                  value={fmtPct(bd.couponU)} valueColor={C_ONCE} />
              </div>
            </Card>

            <Card icon="farm_mech" grad={TAN} title="농장" sub="입장권 소모"
              pct={fmtPct(bd.golden.total + bd.blue.total + bd.mech.total)} pctColor={C_ONCE}>
              <div>
                <TwoLineRow icon="farm_gold" label="황금 딸기 농장" locked={bd.golden.locked}
                  note={bd.golden.locked ? '최대 레벨 초과' : `1회당 ${fmtPct(bd.golden.one)}`}
                  control={<NumInput value={s.items.farmGolden} onChange={(v) => patchDeep('items', { farmGolden: v })} min={0} max={999} chars={3} unit="회" />}
                  value={fmtPct(bd.golden.total)} valueColor={C_ONCE} />
                <TwoLineRow icon="farm_blue" label="블루베리 농장" locked={bd.blue.locked}
                  note={bd.blue.locked ? `Lv.${data.farms.blue.minLevel} 필요` : `1회당 ${fmtPct(bd.blue.one)}`}
                  control={<NumInput value={s.items.farmBlue} onChange={(v) => patchDeep('items', { farmBlue: v })} min={0} max={999} chars={3} unit="회" />}
                  value={fmtPct(bd.blue.total)} valueColor={C_ONCE} />
                <TwoLineRow icon="farm_mech" label="메카베리 농장" locked={bd.mech.locked}
                  note={bd.mech.locked ? `Lv.${data.farms.mech.minLevel} 필요` : `1회당 ${fmtPct(bd.mech.one)}`}
                  control={<NumInput value={s.items.farmMech} onChange={(v) => patchDeep('items', { farmMech: v })} min={0} max={999} chars={3} unit="회" />}
                  value={fmtPct(bd.mech.total)} valueColor={C_ONCE} />
              </div>
            </Card>
          </>
        )}
      </MapleWindow>

      <ConfirmDialog
        open={!!confirmRemove}
        title="캐릭터 삭제"
        description={confirmRemove ? `${confirmRemove.character_name} 캐릭터를 목록에서 삭제할까요?` : ''}
        confirmText="삭제"
        destructive
        onConfirm={() => { removeCharacter(confirmRemove.character_name); setConfirmRemove(null) }}
        onClose={() => setConfirmRemove(null)}
      />
    </IconCtx.Provider>
  )
}
