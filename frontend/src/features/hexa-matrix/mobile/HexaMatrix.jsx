import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../hooks/useAuth'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import CharacterChip from '../../../components/common/CharacterChip'
import { charRevenue } from '../../boss-crystal/logic'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useCharacterLookup } from '../../../hooks/useCharacterLookup'
import { useCharacterRoster } from '../../../hooks/useCharacterRoster'
import { useHexaStore, hexaInitial } from '../store'
import {
  withCosts, isHuntingCore,
  EPIC_DUNGEONS, EPIC_MULTIPLIERS, weeklyIncome, weeksFor, fmtWeeks, fmtNum, fmtMeso, dateAfterWeeks,
} from '../logic'
import {
  CARD, TYPE_STYLE, TYPE_ORDER,
  useResourceIcons, ResIcon, NumInput, Seg, Toggle, SecTitle, FormRow, CoreCard,
} from '../shared'

/**
 * 헥사 강화 계산기 — 모바일.
 * PC와 같은 카드 문법을 세로 한 열로 배치한다. 로직·위젯은 전부 공유(shared/logic).
 */
export default function MobileHexaMatrix() {
  const { user } = useAuth()
  const icons = useResourceIcons()

  const { hydrated } = useFeatureSync({ feature: 'hexa-matrix', store: useHexaStore, initial: hexaInitial })
  const characters = useHexaStore((s) => s.characters)
  const selectedName = useHexaStore((s) => s.selectedName)
  const settings = useHexaStore((s) => s.settings)
  const addCharacter = useHexaStore((s) => s.addCharacter)
  const removeCharacter = useHexaStore((s) => s.removeCharacter)
  const selectCharacter = useHexaStore((s) => s.selectCharacter)
  const set = useHexaStore((s) => s.setSettings)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const {
    addName, setAddName, addError, setAddError,
    dropdownOpen, setDropdownOpen, addAnchorRef, searchMutation, handleSearch,
  } = useCharacterRoster({
    endpoint: (name) => `/api/hexa/lookup?name=${encodeURIComponent(name)}`,
    onResult: (data) => { addCharacter(data.character) },
  })

  const { data: hexaData, error: hexaError } = useCharacterLookup({
    queryKey: ['hexa', selectedName],
    cacheKey: `maple.hexa.data.${selectedName}`,
    endpoint: `/api/hexa/lookup?name=${encodeURIComponent(selectedName)}`,
    enabled: hydrated && !!selectedName,
  })

  // 주간 보스 수익 (로그인 + 보스 계산기 상태가 있을 때만)
  const { data: bossState } = useQuery({
    queryKey: ['me', 'state', 'boss-crystal'],
    queryFn: () => api('/api/me/state/boss-crystal'),
    enabled: !!user,
    staleTime: 60 * 1000,
  })
  const { data: bosses = [] } = useQuery({
    queryKey: ['boss-crystal', 'bosses'],
    queryFn: () => api('/api/boss-crystal/bosses'),
    enabled: !!user && !!bossState?.payload,
    staleTime: 5 * 60 * 1000,
  })
  const bossRevenue = useMemo(() => {
    const p = bossState?.payload
    if (!p?.characters || !bosses.length) return 0
    return p.characters.reduce((sum, c) => sum + charRevenue(c.character_name, p.selections || {}, bosses).revenue, 0)
  }, [bossState, bosses])

  /* ── 계산 (PC와 동일) ── */
  const cores = useMemo(() => (hexaData ? withCosts(hexaData.cores) : []), [hexaData])
  const counted = cores.filter((c) => !(settings.excludeJanus && isHuntingCore(c)))
  const totals = counted.reduce((a, c) => ({
    spentErda: a.spentErda + c.spentErda,
    spentFrag: a.spentFrag + c.spentFrag,
    totalErda: a.totalErda + c.totalErda,
    totalFrag: a.totalFrag + c.totalFrag,
    remainErda: a.remainErda + c.remainErda,
    remainFrag: a.remainFrag + c.remainFrag,
  }), { spentErda: 0, spentFrag: 0, totalErda: 0, totalFrag: 0, remainErda: 0, remainFrag: 0 })

  const income = weeklyIncome(settings, bossRevenue)
  const effRemainErda = Math.max(0, totals.remainErda - settings.etcErdaOnce)
  const erdaWeeks = weeksFor(effRemainErda, income.erda)
  const fragWeeks = weeksFor(totals.remainFrag, income.frag)
  const doneWeeks = Math.max(erdaWeeks, fragWeeks)
  const doneDate = dateAfterWeeks(doneWeeks)
  const [bottleneck, bottleneckJosa] = erdaWeeks > fragWeeks ? ['솔 에르다', '가'] : ['조각', '이']

  const erdaPct = totals.totalErda ? Math.round((totals.spentErda / totals.totalErda) * 100) : 0
  const fragPct = totals.totalFrag ? Math.round((totals.spentFrag / totals.totalFrag) * 100) : 0

  return (
    <>
    <MapleWindow title="HEXA CALCULATOR" bodyClassName="space-y-3">

      {/* 캐릭터 조회 */}
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
            className="w-full rounded-full border-2 px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
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
        <button
          type="submit"
          disabled={searchMutation.isPending}
          className="rounded-full px-5 py-2.5 text-sm font-bold shrink-0 disabled:opacity-50"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.3)',
            color: '#ffffff',
          }}
        >
          {searchMutation.isPending ? '...' : '조회'}
        </button>
      </form>
      {addError && <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{addError}</p>}

      {/* 캐릭터 칩 (가로 스크롤 — 심볼 모바일과 동일 문법) */}
      {characters.length > 0 && (
        <div className="-mx-3.5">
          <OverlayScrollbarsComponent
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
            defer
          >
            <div className="flex w-max gap-2.5 px-3.5 pt-0.5 pb-2">
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

      {/* 강화 진행도 */}
      {selectedName && hexaData && (
        <div className="rounded-[11px] overflow-hidden" style={CARD}>
          <SecTitle right={<Toggle light on={settings.excludeJanus} onChange={(v) => set({ excludeJanus: v })}>솔 야누스 제외</Toggle>}>
            강화 진행도
          </SecTitle>
          <div className="p-2.5 flex flex-col gap-2.5">
            {[
              { label: '솔 에르다', url: icons.erdaUrl, spent: totals.spentErda, total: totals.totalErda, pct: erdaPct, grad: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))' },
              { label: '조각', url: icons.fragUrl, spent: totals.spentFrag, total: totals.totalFrag, pct: fragPct, grad: 'linear-gradient(90deg, var(--mpl-purple-from), var(--mpl-purple-to))' },
            ].map((g) => (
              <div key={g.label} className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2" style={{ background: 'var(--mpl-row)', borderColor: 'var(--mpl-card-line)' }}>
                <ResIcon url={g.url} size={26} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[12px]">
                    <b>{g.label}</b>
                    <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{fmtNum(g.spent)} / {fmtNum(g.total)}</span>
                  </div>
                  <div className="relative h-4 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(31,44,61,.14)' }}>
                    <i className="block h-full rounded-full" style={{ width: `${g.pct}%`, background: g.grad, transition: 'width .6s cubic-bezier(.22, 1, .36, 1)' }} />
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold tabular-nums"
                      style={g.pct >= 50 ? { color: '#ffffff', textShadow: '0 1px 1px rgba(0,0,0,.35)' } : { color: 'var(--text-strong)' }}
                    >
                      {g.pct}%
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {TYPE_ORDER.map((type) => {
              const group = cores.filter((c) => c.type === type)
              if (!group.length) return null
              const st = TYPE_STYLE[type]
              const doneCount = group.filter((c) => c.level >= 30).length
              return (
                <div key={type} className="rounded-xl border-[1.5px] p-2.5" style={{ borderColor: st.line }}>
                  <div className="flex items-center gap-1.5 mb-2 text-[12.5px] font-extrabold" style={{ color: st.accent }}>
                    <i className="w-2 h-2 rounded" style={{ background: st.accent }} />
                    {type}
                    <span className="ml-auto text-[11.5px] font-bold tabular-nums" style={{ color: 'var(--text-dim)' }}>{doneCount} / {group.length} 완료</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.map((c) => (
                      <CoreCard key={c.name} core={c} excluded={settings.excludeJanus && isHuntingCore(c)} icons={icons} compact />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {selectedName && hexaError && (
        <p className="p-6 text-center text-[13px] rounded-[11px]" style={{ ...CARD, color: 'var(--danger-text)' }}>{hexaError.message || '조회 실패'}</p>
      )}

      {/* 수급 */}
      {selectedName && hexaData && (
        <>
          <div className="rounded-[11px] overflow-hidden" style={CARD}>
            <SecTitle>솔 에르다 수급</SecTitle>
            <div className="px-3 py-0.5">
              {/* 폭이 좁아 한 줄에 안 들어간다 — 라벨 아래에 컨트롤을 좌우로 */}
              <div className="py-2.5 text-[13px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold" style={{ color: 'var(--text-muted)' }}>에픽던전</span>
                  <span className="w-[128px]">
                    <Select
                      options={EPIC_DUNGEONS.map((d) => ({ value: d.id, label: d.name }))}
                      value={settings.dungeon}
                      onChange={(v) => set({ dungeon: v })}
                    />
                  </span>
                </div>
                <div className="flex justify-end">
                  <Seg
                    options={EPIC_MULTIPLIERS.map((m, i) => ({ value: m, label: ['기본', '1단계', '2단계'][i] }))}
                    value={settings.multiplier}
                    onChange={(v) => set({ multiplier: v })}
                    disabled={settings.dungeon === 'none'}
                  />
                </div>
              </div>
              <FormRow label="사냥 획득">
                <NumInput value={settings.huntErdaPerDay} onChange={(v) => set({ huntErdaPerDay: v })} max={99} unit="개/일" />
              </FormRow>
              <FormRow label="기타 구매" sub="총량">
                <NumInput value={settings.etcErdaOnce} onChange={(v) => set({ etcErdaOnce: v })} max={9999} chars={3} unit="개" />
              </FormRow>
              <FormRow total label={(
                <span className="text-[12px] font-extrabold rounded-full px-2.5 py-1 border" style={{ color: '#0f6c9c', background: 'rgba(94,205,245,.16)', borderColor: 'rgba(94,205,245,.5)' }}>주당 합계</span>
              )}>
                <b className="text-[13.5px] tabular-nums" style={{ color: 'var(--text-strong)' }}>{fmtNum(income.erda)}개</b>
              </FormRow>
            </div>
          </div>

          <div className="rounded-[11px] overflow-hidden" style={CARD}>
            <SecTitle>솔 에르다 조각 수급</SecTitle>
            <div className="px-3 py-0.5">
              <div className="py-2.5 text-[13px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold" style={{ color: 'var(--text-muted)' }}>구매</span>
                  <Seg
                    options={[{ value: 'count', label: '개수' }, { value: 'meso', label: '총 가격' }]}
                    value={settings.buyMode}
                    onChange={(v) => set({ buyMode: v })}
                  />
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <NumInput value={settings.fragPrice} onChange={(v) => set({ fragPrice: v })} max={99999} chars={4} unit="만 메소" />
                  {settings.buyMode === 'count' ? (
                    <NumInput value={settings.buyCountPerWeek} onChange={(v) => set({ buyCountPerWeek: v })} max={99999} chars={3} unit="개/주" />
                  ) : (
                    <NumInput value={settings.buyMesoPerWeek} onChange={(v) => set({ buyMesoPerWeek: v })} max={999} chars={2} unit="억/주" />
                  )}
                </div>
              </div>
              <FormRow label="사냥 획득">
                <NumInput value={settings.huntFragPerDay} onChange={(v) => set({ huntFragPerDay: v })} max={9999} chars={3} unit="개/일" />
              </FormRow>
              <FormRow label={(
                <Toggle on={settings.useBossRevenue} onChange={(v) => set({ useBossRevenue: v })}>
                  💰 주간 보스 수익으로 최대 구매
                </Toggle>
              )}>
                <span className="inline-flex items-center py-2 text-[12px] font-extrabold tabular-nums whitespace-nowrap" style={{ color: settings.useBossRevenue ? '#7a3fb0' : 'var(--text-dim)', border: '1px solid transparent' }}>
                  {user
                    ? bossRevenue > 0
                      ? `+${fmtNum(income.bossCount || (settings.fragPrice > 0 ? Math.floor(bossRevenue / (settings.fragPrice * 10000)) : 0))} 개/주`
                      : '데이터 없음'
                    : '로그인 필요'}
                </span>
              </FormRow>
              <FormRow total label={(
                <span className="text-[12px] font-extrabold rounded-full px-2.5 py-1 border" style={{ color: '#7a3fb0', background: 'rgba(183,110,230,.13)', borderColor: 'rgba(183,110,230,.45)' }}>주당 합계</span>
              )}>
                <b className="text-[13.5px] tabular-nums" style={{ color: 'var(--text-strong)' }}>
                  {fmtNum(income.frag)}개{income.buyMesoWeekly > 0 && <span className="font-semibold" style={{ color: 'var(--text-muted)' }}> ({fmtMeso(income.buyMesoWeekly)})</span>}
                </b>
              </FormRow>
            </div>
          </div>

          {/* 완료 예상 */}
          <div className="rounded-[11px] overflow-hidden" style={{ ...CARD, borderColor: '#ead9a0' }}>
            <SecTitle>완료 예상</SecTitle>
            <div className="px-3.5 py-3 flex flex-col gap-2.5" style={{ background: 'var(--hexa-result-bg, linear-gradient(180deg,#fffdf2,#fff))' }}>
              <div className="flex items-baseline justify-between">
                <span className="text-[24px] font-black tabular-nums" style={{ color: 'var(--text-strong)' }}>
                  {Number.isFinite(doneWeeks) ? (doneWeeks <= 0 ? '완료!' : `약 ${Math.ceil(doneWeeks)}주`) : '—'}
                </span>
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {Number.isFinite(doneWeeks) && doneWeeks > 0 ? `${doneDate} 완료 예상` : doneWeeks <= 0 ? '모든 코어 만렙' : '수급량을 입력해 주세요'}
                </span>
              </div>
              {[
                { label: '솔 에르다', url: icons.erdaUrl, weeks: erdaWeeks, grad: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))' },
                { label: '조각', url: icons.fragUrl, weeks: fragWeeks, grad: 'linear-gradient(90deg, var(--mpl-purple-from), var(--mpl-purple-to))' },
              ].map((r) => {
                const maxW = Math.max(erdaWeeks, fragWeeks)
                const w = Number.isFinite(r.weeks) && Number.isFinite(maxW) && maxW > 0 ? Math.max(4, (r.weeks / maxW) * 100) : 0
                return (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 w-[82px] text-[12px] font-bold">
                      <ResIcon url={r.url} size={17} />{r.label}
                    </span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 1px 2px rgba(31,44,61,.1)' }}>
                      <i className="block h-full rounded-full" style={{ width: `${w}%`, background: r.grad, transition: 'width .6s cubic-bezier(.22, 1, .36, 1)' }} />
                    </div>
                    <b className="w-12 text-right text-[12.5px] tabular-nums" style={{ color: r.weeks === doneWeeks && r.weeks > 0 ? '#7a3fb0' : 'var(--text-strong)' }}>{fmtWeeks(r.weeks)}</b>
                  </div>
                )
              })}
              <div className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
                {Number.isFinite(doneWeeks) && doneWeeks > 0
                  ? `${bottleneck}${bottleneckJosa} 병목입니다 — ${bottleneck} 수급을 늘리면 그만큼 앞당겨져요`
                  : '주간 수급량을 입력하면 완료 시점을 계산합니다'}
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedName && (
        <div className="rounded-[11px] p-10 text-center" style={CARD}>
          <div className="text-3xl mb-2 opacity-50">⬡</div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>캐릭터를 조회하면 헥사 코어 진행도와<br />완료 시점을 계산합니다</p>
        </div>
      )}

    </MapleWindow>

    <ConfirmDialog
      open={!!confirmRemove}
      onClose={() => setConfirmRemove(null)}
      onConfirm={() => {
        removeCharacter(confirmRemove.character_name)
        setConfirmRemove(null)
      }}
      title="캐릭터 삭제"
      description={confirmRemove ? `"${confirmRemove.character_name}" 캐릭터를 목록에서 삭제하시겠습니까?` : ''}
      confirmText="삭제"
      destructive
    />
    </>
  )
}
