import { useState, useRef, useMemo, useEffect, createContext, useContext } from 'react'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../../api/client'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { Reorder } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import CharacterCard from '../../symbol/pc/user/CharacterCard'
import ExpJourney from './ExpJourney'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useExpStore, expInitialState } from '../store'
import { NumInput, SecTitle, CARD } from '../../hexa-matrix/shared'
import {
  EPIC_STAGES, defaultSettings, zoneOn,
  simulate, breakdown, fmtPct, weekKeyKST, parkSpecialActive,
} from '../logic'


const SKY = 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))'
const PUR = 'linear-gradient(180deg, var(--mpl-purple-from), var(--mpl-purple-to))'
const TAN = 'linear-gradient(180deg, #e6c976, #c8a34e)'
const C_DAY = 'var(--accent-bright)'
const C_WEEK = '#9247c9'
const C_ONCE = '#e8a20c'

/* 드롭다운 앞 아이콘 매핑 */
const EPIC_ICON = { high_mountain: 'ed_highmountain', angler_company: 'ed_angler', nightmare_paradise: 'ed_nightmare' }
/* 몬파 지역 아이콘 — 대부분 일퀘 심볼과 지역 id가 같고, 셀라스만 몬파 전용 */
const PARK_ICON_PREFIX = {
  yeoro: 'arc', chewchew: 'arc', lacheln: 'arc', arcana: 'arc', morass: 'arc', esfera: 'arc',
  moonbridge: 'ten', maze: 'ten', limen: 'ten', sellas: 'mp',
  cernium: 'gra', arcs: 'gra', odium: 'gra', dowonkyung: 'gra', arteria: 'gra', carcion: 'gra', tallahart: 'gra',
}
const parkIconId = (id) => `${PARK_ICON_PREFIX[id]}_${id}`

/* ── 소품 ── */

/*
 * 아이콘은 프런트 번들이 아니라 S3(rustfs)에서 온다 — /api/exp/data 가 슬러그→URL로 내려준다.
 * 컨텍스트로 넘겨 카드마다 props를 실어 나르지 않게 했다.
 */
const IconCtx = createContext({})

function Ico({ id, size = 38 }) {
  const icons = useContext(IconCtx)
  const url = icons[id]
  return url
    ? <img src={url} alt="" className="object-contain" style={{ width: size, height: size, imageRendering: 'pixelated' }} />
    : null
}

/**
 * 컨텐츠 카드 — 심볼 계산기 SymbolCard 문법.
 * 합계(pct)는 항상 카드 맨 아래 줄에 표시한다.
 * toggle을 주면 헤더 우측이 on/off 스위치가 된다.
 */
function ContentCard({ icon, grad, title, sub, pct, pctColor, totalLabel = '합계', toggle, onToggle, children }) {
  const off = toggle === false
  return (
    <div className="rounded-2xl border p-5"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
      <div className={`flex items-center gap-3 ${children ? 'mb-3.5' : ''}`}>
        <div className="w-[52px] h-[52px] rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: grad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)', opacity: off ? 0.45 : 1 }}>
          <Ico id={icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold truncate">{title}</div>
          <div className="text-[12.5px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        {toggle != null && <MiniToggle on={toggle} onChange={onToggle} />}
      </div>
      {children}
      <div className="flex items-center justify-between pt-2.5 mt-3 border-t"
        style={{ borderColor: 'var(--row-divider)' }}>
        <span className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>{totalLabel}</span>
        <span className="text-base font-bold tabular-nums" style={{ color: off ? 'var(--text-dim)' : pctColor }}>{pct}</span>
      </div>
    </div>
  )
}

/** 균등폭 세그먼트 — 라벨 길이와 무관하게 칸 너비가 같고 가로를 꽉 채운다 */
function SegFull({ options, value, onChange }) {
  return (
    <div className="flex w-full h-10 rounded-md overflow-hidden border text-[12.5px] font-bold"
      style={{ borderColor: 'var(--input-border)' }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="flex-1 min-w-0 whitespace-nowrap"
          style={o.value === value
            ? { background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))', color: '#fff' }
            : { background: 'var(--input-bg)', color: 'var(--text-muted)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 라벨 위 + 필드 아래 (심볼 카드 입력 폼) */
function Field({ label, children }) {
  return (
    <div className="space-y-1 min-w-0">
      <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

/** 구분선 있는 결과/토글 행 (valueWidth로 값 칸 폭 조절 — 라벨이 길면 좁힌다) */
function Row({ icon, iconSize = 22, label, sub, value, valueColor = 'var(--text-emphasis)', toggle, onToggle, locked, control, valueWidth = 74 }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-2 border-t first:border-t-0 ${locked ? 'opacity-45' : ''}`}
      style={{ borderColor: 'var(--row-divider)' }}>
      <span className="flex items-center gap-2 text-[13.5px] min-w-0" style={{ color: 'var(--text-muted)' }}>
        {toggle != null && !locked && <MiniToggle on={toggle} onChange={onToggle} />}
        {toggle != null && locked && <span className="w-[34px] shrink-0" />}
        {icon && <Ico id={icon} size={iconSize} />}
        <span className="truncate">{label}</span>
        {sub && <span className="text-[12px] shrink-0" style={{ color: 'var(--text-dim)' }}>{sub}</span>}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {control}
        <span className="tabular-nums font-medium text-[13.5px] text-right" style={{ color: valueColor, minWidth: valueWidth }}>{value}</span>
      </span>
    </div>
  )
}

/** 폭 고정 입력 슬롯 — 단위 글자 수가 달라도(개 / 시간/주) 카드 안 입력칸 너비를 맞춘다 */
function FixedControl({ width = 116, children }) {
  return (
    <span className="inline-block [&>div]:w-full [&>div]:justify-end" style={{ width }}>{children}</span>
  )
}

/**
 * 2줄 행 — 윗줄: 아이콘 + 이름 + 입력 / 아랫줄: 단가 + 결과값.
 * 이름이 길거나 입력칸이 넓어 한 줄에 안 들어갈 때 쓴다.
 */
function TwoLineRow({ icon, label, control, note, value, valueColor, locked }) {
  return (
    <div className={`pt-2.5 border-t first:border-t-0 first:pt-0 ${locked ? 'opacity-45' : ''}`}
      style={{ borderColor: 'var(--row-divider)' }}>
      <div className="flex items-center gap-2">
        <Ico id={icon} size={24} />
        <span className="truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {!locked && <span className="ml-auto shrink-0">{control}</span>}
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{note}</span>
        <span className="tabular-nums font-medium" style={{ color: locked ? 'var(--text-dim)' : valueColor }}>
          {locked ? '—' : value}
        </span>
      </div>
    </div>
  )
}

/** 사이트 라임 토글 (심볼 일퀘 완료 버튼과 동일 계열) */
function MiniToggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="relative w-[34px] h-[22px] rounded-full shrink-0 transition-colors"
      style={{ background: on ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' : 'var(--toggle-off, #c3ced9)' }}>
      <span className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: on ? 14 : 3, boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
    </button>
  )
}

/* ── 페이지 ── */

export default function ExpCalculator() {
  const { hydrated } = useFeatureSync({ feature: 'exp-calculator', store: useExpStore, initial: expInitialState })
  const characters = useExpStore((s) => s.characters)
  const selectedName = useExpStore((s) => s.selectedName)
  const allSettings = useExpStore((s) => s.settings)
  const addCharacter = useExpStore((s) => s.addCharacter)
  const removeCharacter = useExpStore((s) => s.removeCharacter)
  const setCharacters = useExpStore((s) => s.setCharacters)
  const selectCharacter = useExpStore((s) => s.selectCharacter)
  const patchSettings = useExpStore((s) => s.patchSettings)

  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const addAnchorRef = useRef(null)

  const { data } = useQuery({
    queryKey: ['exp', 'data'],
    queryFn: () => api('/api/exp/data'),
    staleTime: Infinity,
  })

  /*
   * 이번 주 스페셜 썬데이 여부 — 안내용.
   * API는 '스페셜 썬데이 주간'인지만 알려주고 혜택 내역(몬파 +250% 등)은 이미지에만 있어서
   * 자동으로 켜지는 않고, 사용자가 토글로 직접 켜도록 힌트만 표시한다.
   */
  const { data: sunday } = useQuery({
    queryKey: ['sunday-maple', 'current'],
    queryFn: () => api('/api/sunday-maple/current'),
    staleTime: 30 * 60 * 1000,
  })
  const sundaySpecialWeek = sunday?.available && sunday.variant === 'special'

  const searchMutation = useMutation({
    mutationFn: (name) => api(`/api/exp/lookup?name=${encodeURIComponent(name)}`),
    onSuccess: (res) => {
      setAddError('')
      setAddName('')
      addCharacter({ ...res.character, exp_rate: res.exp_rate })
    },
    onError: (err) => setAddError(err.message || '조회 실패'),
  })

  /*
   * 선택 캐릭터 재조회 — 넥슨 데이터는 전일 기준이라 추가 시점 스냅샷으로 두면 굳는다.
   * 마지막 응답을 로컬에 캐시해 새로고침 직후에도 깜빡임 없이 그리고 뒤에서 갱신한다. (헥사와 동일 패턴)
   */
  const { data: lookup } = useQuery({
    queryKey: ['exp', 'lookup', selectedName],
    queryFn: async () => {
      const res = await api(`/api/exp/lookup?name=${encodeURIComponent(selectedName)}`)
      try { localStorage.setItem(`maple.exp.data.${selectedName}`, JSON.stringify(res)) } catch { /* noop */ }
      return res
    },
    enabled: hydrated && !!selectedName,
    staleTime: 10 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
    initialData: () => {
      try { return JSON.parse(localStorage.getItem(`maple.exp.data.${selectedName}`)) || undefined } catch { return undefined }
    },
    initialDataUpdatedAt: 0,
  })

  // 재조회 결과로 목록의 레벨·경험치도 최신화
  useEffect(() => {
    if (!lookup?.character) return
    setCharacters((chars) => chars.map((c) => (
      c.character_name === lookup.character.character_name
        ? { ...c, ...lookup.character, id: c.id, exp_rate: lookup.exp_rate }
        : c
    )))
  }, [lookup]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault()
    const n = addName.trim()
    if (n) searchMutation.mutate(n)
  }

  const stored = characters.find((c) => c.character_name === selectedName) || null
  // 표시·계산은 재조회 값 우선 (전일 기준 최신)
  const fresh = lookup?.character?.character_name === selectedName ? lookup : null
  const char = useMemo(
    () => (stored && fresh
      ? { ...stored, ...fresh.character, id: stored.id, exp_rate: fresh.exp_rate }
      : stored),
    [stored, fresh],
  )
  const history = useMemo(() => fresh?.history || [], [fresh])
  const dateCreate = fresh?.date_create || null
  /*
   * 스페셜 썬데이는 켠 주에만 유효 — 월요일 00시(KST)가 지나면 저장값이 남아 있어도
   * 꺼진 것으로 보고 계산한다. 여기서 한 번 정규화해서 아래 로직·UI가 같은 값을 본다.
   */
  const weekKey = weekKeyKST(new Date())
  const rawSettings = (char && allSettings[char.id]) || defaultSettings(char?.character_level || 260)
  const s = useMemo(() => {
    const p = rawSettings.weekly.park
    const active = parkSpecialActive(p, weekKey)
    if (active === !!p.sundaySpecial) return rawSettings
    return { ...rawSettings, weekly: { ...rawSettings.weekly, park: { ...p, sundaySpecial: active } } }
  }, [rawSettings, weekKey])
  const patch = (p) => char && patchSettings(char.id, p)
  const patchDeep = (key, p) => patch((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }))

  const bd = useMemo(
    () => (data && char ? breakdown(data, char, s) : null),
    [data, char, s],
  )

  const goal = s.goal
  const result = useMemo(() => {
    if (!data || !char) return null
    const t = Math.max(char.character_level + 1, Math.min(goal.level || char.character_level + 1, 300))
    const sim = simulate(data, char, s, { targetLevel: t })
    return { target: t, days: sim.days }
  }, [data, char, s, goal])

  const level = char?.character_level || 0

  const icons = data?.icons || {}

  if (!hydrated || !data) return null
  const zoneGroups = [
    { key: 'arcane', title: '아케인리버 일일퀘스트', icon: 'arc_esfera' },
    { key: 'tenebris', title: '테네브리스 일일퀘스트', icon: 'ten_limen' },
    { key: 'grandis', title: '그란디스 일일퀘스트', icon: 'gra_carcion' },
  ]

  return (
    <IconCtx.Provider value={icons}>
    <div className="pb-10 max-w-[1040px] mx-auto">
      <MapleWindow title="EXP CALCULATOR">
        <div className="mpl-page-enter flex flex-col gap-3">

          {/* 캐릭터 */}
          <div className="rounded-[11px] overflow-hidden" style={CARD}>
            <SecTitle>캐릭터</SecTitle>
            <div className="p-3.5 flex flex-col gap-3">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div ref={addAnchorRef} className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--input-icon)' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => { setAddName(e.target.value); if (addError) setAddError('') }}
                    onFocus={() => setDropdownOpen(true)}
                    onClick={() => setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                    placeholder="캐릭터 닉네임 검색"
                    className="w-full h-11 box-border rounded-full border pl-10 pr-5 text-[14px] outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
                  />
                  <CharacterSuggestDropdown
                    open={dropdownOpen}
                    filter={addName}
                    anchorRef={addAnchorRef}
                    excludeNames={characters.map((c) => c.character_name)}
                    onSelect={(n) => {
                      setAddName(n)
                      setDropdownOpen(false)
                      setAddError('')
                      searchMutation.mutate(n)
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchMutation.isPending}
                  className="shrink-0 rounded-full disabled:opacity-50 px-6 h-11 text-[14px] font-bold hover:brightness-105"
                  style={{ background: SKY, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.2)' }}
                >
                  {searchMutation.isPending ? '...' : '조회'}
                </button>
              </form>
              {addError && <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{addError}</p>}

              {characters.length > 0 && (
                <OverlayScrollbarsComponent
                  options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
                  defer
                >
                  <Reorder.Group as="div" axis="x" values={characters} onReorder={setCharacters} className="flex items-start gap-3 pt-1 pb-1.5">
                    {characters.map((c) => (
                      <CharacterCard
                        key={c.id || c.character_name}
                        char={c}
                        active={c.character_name === selectedName}
                        onSelect={() => selectCharacter(c.character_name)}
                        onRemove={() => setConfirmRemove(c)}
                      />
                    ))}
                  </Reorder.Group>
                </OverlayScrollbarsComponent>
              )}
              {characters.length === 0 && (
                <p className="py-6 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
                  캐릭터를 조회하면 목표 레벨까지 걸리는 시간을 계산합니다
                </p>
              )}
            </div>
          </div>

          {/* 캐릭터 여정 — 프로필·통계·등반차트·목표 통합 */}
          {char && bd && result && (
            <ExpJourney
              char={char}
              history={history}
              dateCreate={dateCreate}
              goal={goal}
              result={result}
              breakdown={bd}
              onGoalLevel={(v) => patchDeep('goal', { level: v })}
            />
          )}

          {/* 컨텐츠 카드 */}
          {char && bd && (
            <div className="grid grid-cols-1 min-[820px]:grid-cols-2 min-[1120px]:grid-cols-3 gap-3.5 items-start">

              {/* ── 1열: 일일 컨텐츠 ── */}
              <div className="flex flex-col gap-3.5">
              {/* 일일 퀘스트 그룹 3장 */}
              {zoneGroups.map((g) => (
                <ContentCard key={g.key} icon={g.icon} grad="linear-gradient(180deg,#7cc7ea,#4da4d4)" title={g.title}
                  sub={(() => {
                    const open = data.daily[g.key].filter((z) => level >= z.minLevel)
                    const on = open.filter((z) => zoneOn(s.daily, z.id)).length
                    return `${on}/${open.length} 지역 선택됨`
                  })()}
                  pct={fmtPct(bd.zones[`${g.key}Total`])} pctColor={C_DAY}>
                  <div className="text-[13.5px]">
                    {data.daily[g.key].filter((z) => level >= z.minLevel).map((z) => {
                      const zb = bd.zones[z.id]
                      return (
                        <Row
                          key={z.id}
                          icon={`${g.key === 'arcane' ? 'arc' : g.key === 'tenebris' ? 'ten' : 'gra'}_${z.id}`}
                          label={z.name}
                          toggle={zb.on}
                          onToggle={(v) => patch((prev) => ({ ...prev, daily: { ...prev.daily, [z.id]: v } }))}
                          value={fmtPct(zb.pct)}
                          valueColor={zb.on ? C_DAY : 'var(--text-dim)'}
                        />
                      )
                    })}
                  </div>
                </ContentCard>
              ))}


              </div>

              {/* ── 2열: 주간 컨텐츠 ── */}
              <div className="flex flex-col gap-3.5">
              {/* 사냥 */}
              <ContentCard icon="hunt" grad={PUR} title="사냥" sub="1소재 = 30분"
                pct={fmtPct(bd.hunt)} pctColor={C_WEEK} totalLabel="일일 합계">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="1소재당 획득 경험치 (%)">
                    <input
                      type="text" inputMode="decimal"
                      value={String(s.hunt.pctPerRun ?? 0)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, '')
                        patchDeep('hunt', { pctPerRun: v === '' ? 0 : Math.min(parseFloat(v) || 0, 100) })
                      }}
                      className="w-full h-10 rounded-md border px-3 text-base text-right tabular-nums outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
                    />
                  </Field>
                  <Field label="하루 소재 수">
                    <input
                      type="text" inputMode="numeric"
                      value={String(s.hunt.runsPerDay ?? 0)}
                      onChange={(e) => patchDeep('hunt', { runsPerDay: Math.min(parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0, 48) })}
                      className="w-full h-10 rounded-md border px-3 text-base text-right tabular-nums outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
                    />
                  </Field>
                </div>
              </ContentCard>

              {/* 사우나 · 리조트 */}
              <ContentCard icon="sauna" grad={PUR} title="리조트 · 사우나" sub="잠수 경험치"
                pct={fmtPct(bd.mvp + bd.vip)} pctColor={C_WEEK}>
                <div className="text-[13.5px]">
                  <TwoLineRow icon="sauna" label="MVP 리조트" note={`1시간당 ${fmtPct(bd.saunaHourPct)}`}
                    control={<FixedControl><NumInput value={s.weekly.mvpHours} onChange={(v) => patchDeep('weekly', { mvpHours: v })} min={0} max={99} chars={3} unit="시간/주" /></FixedControl>}
                    value={fmtPct(bd.mvp)} valueColor={C_WEEK} />
                  <TwoLineRow icon="sauna_vip" label="VIP 사우나 이용권" note={`1개(30분)당 ${fmtPct(bd.vipOne)}`}
                    control={<FixedControl><NumInput value={s.items.vipTickets} onChange={(v) => patchDeep('items', { vipTickets: v })} min={0} max={999} chars={3} unit="개" /></FixedControl>}
                    value={fmtPct(bd.vip)} valueColor={C_WEEK} />
                </div>
              </ContentCard>

              {/* 몬스터파크 — 일요일 보너스는 자동 반영 (주 1회) */}
              <ContentCard icon="mp" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="몬스터파크"
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
                    <input
                      type="text" inputMode="numeric"
                      value={String(s.weekly.park.runs ?? 0)}
                      onChange={(e) => patchDeep('weekly', {
                        park: { ...s.weekly.park, runs: Math.min(parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0, 7) },
                      })}
                      className="w-full h-10 rounded-md border px-3 text-base text-right tabular-nums outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
                    />
                  </Field>
                </div>
                <div className="text-[13.5px] mt-2.5">
                  <Row
                    label="스페셜 썬데이"
                    sub={sundaySpecialWeek ? '이번 주' : null}
                    toggle={!!s.weekly.park.sundaySpecial}
                    onToggle={(v) => patchDeep('weekly', { park: { ...s.weekly.park, sundaySpecial: v, sundaySpecialWeek: v ? weekKey : null } })}
                    value={s.weekly.park.sundaySpecial ? '일요일 400%' : '일요일 150%'}
                    valueColor={s.weekly.park.sundaySpecial ? C_WEEK : 'var(--text-dim)'}
                    valueWidth={86}
                  />
                </div>
              </ContentCard>

              {/* 익스트림 몬스터파크 — 주간 1회 고정, 헤더 스위치 + 하단 합계 */}
              <ContentCard icon="mp_extreme" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="익스트림 몬스터파크"
                sub={bd.extreme.locked ? 'Lv.260 필요' : '주간 1회 · 목요일 초기화'}
                pct={fmtPct(bd.extreme.total)} pctColor={C_WEEK} totalLabel="주간 합계"
                toggle={!!s.weekly.extreme.on} onToggle={(v) => patchDeep('weekly', { extreme: { on: v } })} />

              {/* 에픽던전 — 헤더 스위치로 진행 여부, 합계는 카드 하단 */}
              <ContentCard icon="ed_nightmare" grad="linear-gradient(180deg,#b98fdd,#9868c7)" title="에픽던전"
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
              </ContentCard>

              </div>

              {/* ── 3열: 일회성 아이템 ── */}
              <div className="flex flex-col gap-3.5">
              {/* 성장의 비약 — 종류별로 펼쳐서 개수 입력 */}
              <ContentCard icon="elixir" grad={TAN} title="성장의 비약" sub="일회성 소모"
                pct={fmtPct(bd.elixir + bd.e200 + bd.e250)} pctColor={C_ONCE}>
                <div className="text-[13.5px]">
                  {data.elixirs.map((e) => (
                    <TwoLineRow key={e.id} icon={`elixir_${e.id}`} label={e.name}
                      note={`1개당 ${fmtPct(bd.elixirOne[e.id])}`}
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
              </ContentCard>

              {/* EXP 교환권 */}
              <ContentCard icon="coupon" grad={TAN} title="EXP 교환권" sub="일회성 소모"
                pct={fmtPct(bd.couponN + bd.couponU)} pctColor={C_ONCE}>
                <div className="text-[13.5px]">
                  <TwoLineRow icon="coupon" label="EXP 교환권" note={`1개당 ${fmtPct(bd.couponNOne)}`}
                    control={<NumInput value={s.items.couponNormal} onChange={(v) => patchDeep('items', { couponNormal: v })} min={0} max={99999} chars={5} unit="개" />}
                    value={fmtPct(bd.couponN)} valueColor={C_ONCE} />
                  <TwoLineRow icon="coupon_up" label="상급 EXP 교환권" note={`1개당 ${fmtPct(bd.couponUOne)}`}
                    control={<NumInput value={s.items.couponUpper} onChange={(v) => patchDeep('items', { couponUpper: v })} min={0} max={99999} chars={5} unit="개" />}
                    value={fmtPct(bd.couponU)} valueColor={C_ONCE} />
                </div>
              </ContentCard>

              {/* 농장 */}
              <ContentCard icon="farm_mech" grad={TAN} title="농장" sub="입장권 소모"
                pct={fmtPct(bd.golden.total + bd.blue.total + bd.mech.total)} pctColor={C_ONCE}>
                <div className="text-[13.5px]">
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
              </ContentCard>
              </div>
            </div>
          )}
        </div>
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
    </div>
    </IconCtx.Provider>
  )
}
