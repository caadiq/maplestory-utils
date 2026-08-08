import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useSymbolStore, symbolInitialState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useCharacterRoster } from '../../../hooks/useCharacterRoster'
import { useSymbolCharacterSync } from '../useSymbolCharacterSync'
import { symbolMetrics } from '../logic'
import { formatKoreanDate, TYPE_ORDER } from '../utils'
import { formatMeso } from '../../../utils/formatting'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import SymbolCard from '../pc/user/SymbolCard'
import SymbolLevelSheet from './SymbolLevelSheet'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import CharacterChip from '../../../components/common/CharacterChip'
import PageLoader from '../../../components/common/PageLoader'

export default function Symbol() {
  const { hydrated } = useFeatureSync({ feature: 'symbol', store: useSymbolStore, initial: symbolInitialState })

  const { data: allSymbols = [], isLoading: symbolsLoading } = useQuery({
    queryKey: ['symbol', 'symbols'],
    queryFn: () => api('/api/symbols').catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  const tabs = useMemo(() => {
    const groups = {}
    for (const s of allSymbols) if (!groups[s.type]) groups[s.type] = s
    return TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ key: t, label: `${t} 심볼`, image_url: groups[t].image_url }))
  }, [allSymbols])

  const characters = useSymbolStore((s) => s.characters)
  const selectedCharId = useSymbolStore((s) => s.selectedCharId)
  const addCharacter = useSymbolStore((s) => s.addCharacter)
  const removeCharacter = useSymbolStore((s) => s.removeCharacter)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const selectCharacter = useSymbolStore((s) => s.selectCharacter)
  const storedTab = useSymbolStore((s) => s.selectedTabs?.[selectedCharId])
  const setTabStore = useSymbolStore((s) => s.setTab)
  const tab = storedTab || tabs[0]?.key || null
  const setTab = (t) => { if (selectedCharId) setTabStore(selectedCharId, t) }

  useSymbolCharacterSync(allSymbols)

  const [levelSheetOpen, setLevelSheetOpen] = useState(false)
  const {
    addName, setAddName, addError, setAddError,
    dropdownOpen, setDropdownOpen, addAnchorRef, searchMutation, handleSearch,
  } = useCharacterRoster({
    endpoint: (name) => `/api/character/search?name=${encodeURIComponent(name)}`,
    onResult: (data) => {
      if (characters.find((c) => c.character_name === data.character_name)) return '이미 추가된 캐릭터입니다'
      addCharacter(data)
    },
  })

  const progress = useSymbolStore((s) => s.progress[selectedCharId])
  const isEquipped = (id) => !!progress?.[id]?.equipped
  const selectedChar = characters.find((c) => c.id === selectedCharId)
  const symbols = allSymbols.filter((s) => s.type === tab)
  const tabInfo = tabs.find((t) => t.key === tab)

  const { totalRequiredMeso, totalArrearMeso, overallDate } = useMemo(() => {
    let req = 0, arr = 0, latest = null
    for (const s of symbols) {
      const p = progress?.[s.id]
      const m = symbolMetrics({ symbol: s, progress: p, equipped: !!p?.equipped, eventSkill: selectedChar?.event_skill, artifact: selectedChar?.artifact })
      if (!m.equipped || m.isMax) continue
      req += m.remainingMeso
      arr += m.arrearMeso
      if (!m.effectivelyMax && m.completeDate && (!latest || m.completeDate > latest)) latest = m.completeDate
    }
    return { totalRequiredMeso: req, totalArrearMeso: arr, overallDate: latest }
  }, [symbols, progress, selectedChar?.event_skill, selectedChar?.artifact])

  if (symbolsLoading || !hydrated) return <PageLoader />

  return (
    <>
    <MapleWindow
      className="mpl-page-enter"
      title="SYMBOL CALCULATOR"
      titleRight={(
        <button
          type="button"
          onClick={() => setLevelSheetOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-purple-from), var(--mpl-purple-to))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 2px 5px rgba(31,44,61,.25)',
            color: '#ffffff',
          }}
        >
          ⊞ 레벨별 비용표
        </button>
      )}
      tabs={tabs.length > 0 ? tabs.map((t) => (
        <MapleWindowTab key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} compact>
          {t.image_url && <img src={t.image_url} alt="" className="w-5 h-5 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />}
          {t.key}
        </MapleWindowTab>
      )) : undefined}
      bodyClassName="space-y-3"
    >
      {/* 캐릭터 추가 */}
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

      {/* 캐릭터 칩 (가로 스크롤) */}
      {characters.length > 0 && (
        <div className="-mx-3.5">
          <OverlayScrollbarsComponent
            className="pb-0"
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
            defer
          >
            <div className="flex w-max gap-2.5 px-3.5 pt-0.5 pb-2">
              {characters.map((c) => (
                <CharacterChip
                  key={c.id}
                  char={c}
                  active={c.id === selectedCharId}
                  onSelect={() => selectCharacter(c.id)}
                  onRemove={() => setConfirmRemove(c)}
                />
              ))}
            </div>
          </OverlayScrollbarsComponent>
        </div>
      )}

      {!selectedCharId ? (
        <div className="-mt-1.5 rounded-2xl border border-dashed p-12 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)', color: 'var(--text-dim)' }}>
          캐릭터를 추가하고 선택해주세요
        </div>
      ) : (
        <div className="space-y-3 -mt-1.5">
          {/* 심볼 카드 리스트 */}
          {symbols.map((s) => (
            <SymbolCard key={s.id} symbol={s} equipped={isEquipped(s.id)} charId={selectedCharId} />
          ))}

          {/* 전체 요약 (게임 심볼 패널 톤의 보라 그라데이션 바) */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'linear-gradient(180deg, #8f9fe0, #7583cf)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 4px 12px rgba(117,131,207,.35)',
              color: '#ffffff',
            }}
          >
            <div>
              <div className="text-xs" style={{ opacity: 0.85 }}>{tabInfo?.label} 전체 만렙 완료 예상일</div>
              <div className="text-xl font-bold tabular-nums mt-0.5">
                {overallDate ? formatKoreanDate(overallDate) : '-'}
              </div>
            </div>
            <div className="flex gap-4 pt-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,.25)' }}>
              <div className="flex-1">
                <div className="text-xs" style={{ opacity: 0.85 }}>누적 체납 메소</div>
                <div className="text-base font-bold tabular-nums mt-0.5">{totalArrearMeso.toLocaleString()}</div>
                <div className="text-[11px]" style={{ opacity: 0.7 }}>{formatMeso(totalArrearMeso)}</div>
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ opacity: 0.85 }}>남은 필요 메소</div>
                <div className="text-base font-bold tabular-nums mt-0.5">{totalRequiredMeso.toLocaleString()}</div>
                <div className="text-[11px]" style={{ opacity: 0.7 }}>{formatMeso(totalRequiredMeso)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </MapleWindow>

    <ConfirmDialog
      open={!!confirmRemove}
      onClose={() => setConfirmRemove(null)}
      onConfirm={() => {
        removeCharacter(confirmRemove.id)
        setConfirmRemove(null)
      }}
      title="캐릭터 삭제"
      description={confirmRemove ? `"${confirmRemove.character_name}" 캐릭터를 목록에서 삭제하시겠습니까?\n\n저장된 심볼 진행도도 함께 삭제됩니다.` : ''}
      confirmText="삭제"
      destructive
    />
    <SymbolLevelSheet open={levelSheetOpen} onClose={() => setLevelSheetOpen(false)} allSymbols={allSymbols} />
    </>
  )
}
