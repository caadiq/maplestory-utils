import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useBossStore, bossInitialState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useCharacterRoster } from '../../../hooks/useCharacterRoster'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import CharacterChip from '../../../components/common/CharacterChip'
import Select from '../../../components/common/Select'
import { DIFFICULTIES, formatMeso } from '../pc/admin/constants'
import { MAX_PER_CHARACTER, MAX_PER_ACCOUNT, LABEL_EN, charRevenue, seasonBossesFor } from '../logic'
import BossPriceModal from './BossPriceModal'
import MapleWindow from '../../../components/pc/MapleWindow'
import PageLoader from '../../../components/common/PageLoader'

export default function BossCrystal() {
  const { hydrated } = useFeatureSync({ feature: 'boss-crystal', store: useBossStore, initial: bossInitialState })

  const characters = useBossStore((s) => s.characters)
  const selectedChar = useBossStore((s) => s.selectedChar)
  const selections = useBossStore((s) => s.selections)
  const addCharacter = useBossStore((s) => s.addCharacter)
  const removeCharacter = useBossStore((s) => s.removeCharacter)
  const selectCharacter = useBossStore((s) => s.selectCharacter)
  const setBossSelection = useBossStore((s) => s.setBossSelection)

  const { data: bosses = [], isLoading: bossesLoading } = useQuery({
    queryKey: ['boss-crystal', 'bosses'],
    queryFn: () => api('/api/boss-crystal/bosses').catch(() => []),
  })

  const [priceOpen, setPriceOpen] = useState(false)
  const {
    addName: name, setAddName: setName, addError: error, setAddError: setError,
    dropdownOpen, setDropdownOpen, addAnchorRef, searchMutation, handleSearch: handleAdd,
  } = useCharacterRoster({
    endpoint: (n) => `/api/character/search?name=${encodeURIComponent(n)}`,
    onResult: (data) => {
      if (characters.find((c) => c.character_name === data.character_name)) return '이미 추가된 캐릭터입니다'
      addCharacter(data)
    },
  })

  const { totalCount, totalRevenue } = useMemo(() => {
    let tc = 0, tr = 0
    characters.forEach((c) => {
      const r = charRevenue(c.character_name, selections, bosses)
      tc += r.count
      tr += r.revenue
    })
    return { totalCount: tc, totalRevenue: tr }
  }, [characters, selections, bosses])

  const accountUsage = Math.min(totalCount, MAX_PER_ACCOUNT)
  const usagePct = Math.min((accountUsage / MAX_PER_ACCOUNT) * 100, 100)

  const currentSel = selectedChar ? (selections[selectedChar] || {}) : {}
  // 시즌보스는 결정석 한도(12개) 미포함
  const seasonIds = new Set(bosses.filter((b) => b.season).map((b) => b.id))
  const currentCount = Object.entries(currentSel)
    .filter(([bossId, sel]) => sel && !seasonIds.has(Number(bossId))).length
  const maxReached = currentCount >= MAX_PER_CHARACTER

  // 선택 캐릭터에게 노출할 목록: 시즌보스(챌린저스+활성 시즌) 먼저, 그 뒤 일반 보스
  const selectedWorld = characters.find((c) => c.character_name === selectedChar)?.world_name
  const visibleBosses = [
    ...seasonBossesFor(selectedWorld, bosses),
    ...bosses.filter((b) => !b.season),
  ]

  const PANEL = {
    background: 'var(--panel-bg)',
    borderColor: 'var(--panel-border)',
    boxShadow: 'var(--panel-shadow)',
  }

  if (bossesLoading || !hydrated) return <PageLoader />

  return (
    <div className="mpl-page-enter space-y-4">
      {/* 계정 전체 수익 요약 + 캐릭터 추가 (게임창) */}
      <MapleWindow title="WEEKLY PROFIT">
        {/* 메소 코인 필 */}
        <div
          className="flex items-center gap-2.5 rounded-full pl-4 pr-4 py-2.5"
          style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
        >
          <span
            className="w-[20px] h-[20px] rounded-full shrink-0"
            style={{
              background: 'radial-gradient(circle at 35% 30%, #ffe98a, #f5b93c 65%, #c98f1d)',
              boxShadow: 'inset 0 -1px 2px rgba(0,0,0,.25)',
            }}
          />
          <span className="flex-1 text-lg font-bold tabular-nums truncate" style={{ color: 'var(--accent-bright)' }}>
            {formatMeso(totalRevenue)}
          </span>
          <span
            className="text-xs font-bold tabular-nums shrink-0"
            style={{ color: totalCount > MAX_PER_ACCOUNT ? 'var(--danger-text)' : 'var(--text-muted)' }}
          >
            {accountUsage} / {MAX_PER_ACCOUNT}
          </span>
        </div>
        {/* CRYSTAL 게이지 */}
        <div className="flex items-center gap-2.5 mt-3 px-1">
          <span className="text-[11px] font-bold shrink-0" style={{ color: 'var(--text-dim)', letterSpacing: '1px' }}>CRYSTAL</span>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)', boxShadow: 'inset 0 1px 2px rgba(44,55,69,.12)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${usagePct}%`,
                background: totalCount > MAX_PER_ACCOUNT
                  ? 'var(--progress-red)'
                  : 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))',
              }}
            />
          </div>
        </div>
        {/* 캐릭터 추가 */}
        <form onSubmit={handleAdd} className="flex gap-2 mt-3.5" style={{ marginBottom: 0 }}>
          <div ref={addAnchorRef} className="relative flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError('') }}
              onFocus={() => setDropdownOpen(true)}
              onClick={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="캐릭터 닉네임 검색"
              className="w-full rounded-full border-2 px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-strong)' }}
            />
            <CharacterSuggestDropdown
              open={dropdownOpen}
              filter={name}
              anchorRef={addAnchorRef}
              excludeNames={characters.map((c) => c.character_name)}
              onSelect={(n) => { setName(n); setDropdownOpen(false); setError(''); searchMutation.mutate(n) }}
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
            {searchMutation.isPending ? '...' : '추가'}
          </button>
        </form>
        {error && <p className="text-sm mt-2" style={{ color: 'var(--danger-text)' }}>{error}</p>}

      {/* 캐릭터 칩 (가로 스크롤) */}
      {characters.length > 0 && (
        <div className="-mx-3.5 -mb-1.5">
          <OverlayScrollbarsComponent
            className="pt-3 pb-0"
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
            defer
          >
            <div className="flex w-max gap-2.5 px-3.5 pb-1.5">
          {characters.map((c) => {
            const r = charRevenue(c.character_name, selections, bosses)
            return (
              <CharacterChip
                key={c.character_name}
                char={c}
                active={c.character_name === selectedChar}
                onSelect={() => selectCharacter(c.character_name)}
                onRemove={() => removeCharacter(c.character_name)}
                footer={(
                  <div className="text-sm tabular-nums mt-1" style={{ color: r.revenue > 0 ? 'var(--accent-bright)' : 'var(--text-dim)' }}>
                    {r.revenue > 0 ? `${formatMeso(r.revenue)} · ${r.count}개` : '미선택'}
                  </div>
                )}
              />
            )
          })}
            </div>
          </OverlayScrollbarsComponent>
        </div>
      )}
      </MapleWindow>

      {/* 보스 선택 */}
      {!selectedChar ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)', color: 'var(--text-dim)' }}>
          캐릭터를 추가하고 선택해주세요
        </div>
      ) : bosses.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)', color: 'var(--text-dim)' }}>
          등록된 보스가 없습니다
        </div>
      ) : (
        <MapleWindow title="BOSS SELECT" bodyClassName="space-y-2">
          {/* 슬레이트 필 헤더 */}
          <div
            className="flex items-center justify-between px-3.5 py-2 rounded-full"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
            }}
          >
            <button
              type="button"
              onClick={() => setPriceOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold"
              style={{ color: '#ffffff', textShadow: '0 1px 1px rgba(44,55,69,.3)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1.5 6H14.5M6 6V13.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              전체 가격표
            </button>
            <span className="text-xs font-bold tabular-nums" style={{ color: maxReached ? '#ffb3a8' : '#cfdae4' }}>
              {currentCount} / {MAX_PER_CHARACTER}
            </span>
          </div>
          {visibleBosses.map((boss) => {
            const isSeason = !!boss.season
            const availableDiffs = DIFFICULTIES.filter((d) => boss.difficulties.some((bd) => bd.difficulty === d.key))
            const sel = currentSel[boss.id]
            const bdInfo = sel ? boss.difficulties.find((bd) => bd.difficulty === sel.difficulty) : null
            const partyN = sel?.party || 1
            const revenue = bdInfo ? Math.floor(bdInfo.crystal_price / partyN) : 0
            const disabled = maxReached && !sel && !isSeason
            const partyOptions = Array.from({ length: boss.max_party_size }, (_, i) => i + 1).map((n) => ({ value: n, label: `${n}인` }))

            return (
              <div
                key={boss.id}
                className="rounded-xl p-3"
                style={{
                  background: 'var(--mpl-card)',
                  boxShadow: isSeason ? 'inset 0 0 0 1.5px #eec584' : 'inset 0 0 0 1px var(--mpl-card-line)',
                  opacity: disabled ? 'var(--disabled-opacity)' : 1,
                  pointerEvents: disabled ? 'none' : 'auto',
                }}
              >
                {/* 보스 이미지 + 이름 + 수익 */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: 'var(--surface-nested)' }}>
                    <img src={boss.image_url || '/default.png'} alt={boss.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-semibold flex-1 truncate">
                    {boss.name}
                    {isSeason && (
                      <span
                        className="ml-1.5 inline-block align-middle rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          background: 'linear-gradient(180deg, #f7dcab, #eec584)',
                          boxShadow: 'inset 0 0 0 1px #e3b878',
                          color: '#9a6a10',
                        }}
                      >
                        시즌
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-medium tabular-nums" style={{ color: sel ? 'var(--accent-bright)' : 'var(--text-dim)' }}>
                    {sel ? formatMeso(revenue) : '-'}
                  </span>
                </div>

                {/* 난이도 버튼 + 파티 */}
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                    {availableDiffs.map((d) => {
                      const active = sel?.difficulty === d.key
                      const hasVisibleBorder = d.colors.border !== d.colors.bg
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={(e) => {
                            e.currentTarget.blur()
                            if (active) setBossSelection(selectedChar, boss.id, null)
                            else setBossSelection(selectedChar, boss.id, { difficulty: d.key, party: partyN })
                          }}
                          style={{
                            background: d.colors.bg,
                            borderColor: hasVisibleBorder ? d.colors.border : 'rgba(0,0,0,0.55)',
                            borderWidth: '1.5px',
                            color: d.colors.text,
                            filter: active ? 'none' : 'var(--inactive-filter)',
                          }}
                          className="shrink-0 rounded-full border-solid px-3 h-7 text-[11px] font-bold tracking-wider"
                        >
                          {LABEL_EN[d.key] || d.key.toUpperCase()}
                        </button>
                      )
                    })}
                  </div>
                  {sel && (
                    <div className="w-20 shrink-0">
                      <Select
                        value={partyN}
                        onChange={(val) => setBossSelection(selectedChar, boss.id, { ...sel, party: val })}
                        options={partyOptions}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </MapleWindow>
      )}

      <BossPriceModal open={priceOpen} onClose={() => setPriceOpen(false)} bosses={bosses} />
    </div>
  )
}
