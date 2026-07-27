import { useState, useLayoutEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Reorder } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
import Tooltip from '../../../components/common/Tooltip'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import { useSymbolStore, symbolInitialState } from '../store'
import { formatMesoKorean } from '../../../utils/formatting'
import { formatKoreanDate, TYPE_ORDER } from '../utils'
import { symbolMetrics } from '../logic'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useSymbolCharacterSync } from '../useSymbolCharacterSync'
import PageLoader from '../../../components/common/PageLoader'
import CharacterCard from './user/CharacterCard'
import SymbolCard from './user/SymbolCard'
import SymbolLevelTableModal from './user/SymbolLevelTableModal'

export default function Symbol() {
  const { hydrated } = useFeatureSync({ feature: 'symbol', store: useSymbolStore, initial: symbolInitialState })

  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  // 심볼 목록 (DB에서 로드)
  const { data: allSymbols = [], isLoading: symbolsLoading } = useQuery({
    queryKey: ['symbol', 'symbols'],
    queryFn: () => api('/api/symbols').catch(() => []),
    staleTime: 5 * 60 * 1000,
  })


  const tabs = useMemo(() => {
    const groups = {}
    for (const s of allSymbols) {
      if (!groups[s.type]) groups[s.type] = s
    }
    return TYPE_ORDER
      .filter((t) => groups[t])
      .map((t) => ({ key: t, label: `${t} 심볼`, image_url: groups[t].image_url }))
  }, [allSymbols])

  const characters = useSymbolStore((s) => s.characters)
  const selectedCharId = useSymbolStore((s) => s.selectedCharId)
  const addCharacter = useSymbolStore((s) => s.addCharacter)
  const removeCharacter = useSymbolStore((s) => s.removeCharacter)
  const selectCharacter = useSymbolStore((s) => s.selectCharacter)
  const setCharacters = useSymbolStore((s) => s.setCharacters)
  const storedTab = useSymbolStore((s) => s.selectedTabs?.[selectedCharId])
  const setTabStore = useSymbolStore((s) => s.setTab)

  const tab = storedTab || tabs[0]?.key || null
  const setTab = (t) => { if (selectedCharId) setTabStore(selectedCharId, t) }

  // 캐릭터 기본정보·장착 심볼 동기화 (PC·모바일 공용 훅)
  useSymbolCharacterSync(allSymbols)

  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [levelTableOpen, setLevelTableOpen] = useState(false)
  const addAnchorRef = useRef(null)

  const symbols = allSymbols.filter((s) => s.type === tab)
  const tabInfo = tabs.find((t) => t.key === tab)

  const searchMutation = useMutation({
    mutationFn: (name) => api(`/api/character/search?name=${encodeURIComponent(name)}`),
    onSuccess: (data) => {
      if (characters.find((c) => c.character_name === data.character_name)) {
        setAddError('이미 추가된 캐릭터입니다')
        return
      }
      setAddError('')
      setAddName('')
      addCharacter(data)
    },
    onError: (err) => setAddError(err.message || '조회 실패'),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    const n = addName.trim()
    if (!n) return
    setAddError('')
    searchMutation.mutate(n)
  }

  const progress = useSymbolStore((s) => s.progress[selectedCharId])
  const isEquipped = (symbolId) => !!progress?.[symbolId]?.equipped

  // 현재 탭의 누적 메소 + 최종 완료일 계산
  const selectedChar = characters.find((c) => c.id === selectedCharId)
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

  return (
    <div className="pb-10 max-w-6xl mx-auto">
      <MapleWindow
        title="SYMBOL CALCULATOR"
        titleRight={(
          <button
            type="button"
            onClick={() => setLevelTableOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold hover:brightness-105"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-purple-from), var(--mpl-purple-to))',
              color: '#ffffff',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 2px 5px rgba(31,44,61,.25)',
            }}
          >
            ⊞ 레벨별 비용표
          </button>
        )}
        tabs={tabs.map((t) => (
          <MapleWindowTab key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.image_url && (
              <img src={t.image_url} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} />
            )}
            {t.label}
          </MapleWindowTab>
        ))}
      >
        {symbolsLoading || !hydrated ? <PageLoader /> : (
        <div className="mpl-page-enter space-y-4">
        <div className="">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div ref={addAnchorRef} className="relative flex-1">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--input-icon)' }}
            >
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
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="캐릭터 닉네임 검색"
              className="w-full h-12 box-border rounded-full border pl-10 pr-5 text-base outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--text-strong)',
              }}
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
            className="shrink-0 rounded-full disabled:opacity-50 px-6 h-12 text-base font-bold hover:brightness-105"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
              color: '#ffffff',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.2)',
            }}
          >
            {searchMutation.isPending ? '...' : '조회'}
          </button>
        </form>
        {addError && (
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{addError}</p>
        )}
        </div>

        {/* 캐릭터 목록 */}
        {characters.length > 0 && (
          <div className="">
          <OverlayScrollbarsComponent
            className=""
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
            defer
          >
            <Reorder.Group
              as="div"
              axis="x"
              values={characters}
              onReorder={setCharacters}
              className="flex items-start gap-3 pt-1 pb-4"
            >
              {characters.map((c) => (
                <CharacterCard
                  key={c.id}
                  char={c}
                  active={c.id === selectedCharId}
                  onSelect={() => selectCharacter(c.id)}
                  onRemove={() => removeCharacter(c.id)}
                />
              ))}
            </Reorder.Group>
          </OverlayScrollbarsComponent>
          </div>
        )}

      {/* 심볼 카드 그리드 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((s) => (
          <SymbolCard key={s.id} symbol={s} equipped={isEquipped(s.id)} charId={selectedCharId} />
        ))}
      </div>

      {/* 전체 요약 (게임 심볼 패널 톤의 보라 그라데이션 바) */}
      <div
        className="rounded-xl px-6 py-4 flex items-center justify-between gap-6 flex-wrap"
        style={{
          background: 'linear-gradient(180deg, #8f9fe0, #7583cf)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 4px 12px rgba(117,131,207,.35)',
          color: '#ffffff',
        }}
      >
        <div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,.85)' }}>
            {tabInfo?.label} 전체 만렙 완료 예상일
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {overallDate ? formatKoreanDate(overallDate) : '-'}
          </div>
        </div>
        <div className="flex items-center text-right">
          <div className="pr-8">
            <div className="text-sm" style={{ color: 'rgba(255,255,255,.85)' }}>누적 체납 메소</div>
            <Tooltip text={formatMesoKorean(totalArrearMeso)}>
              <div className="text-xl font-bold tabular-nums mt-1 inline-block" style={{ color: '#ffc9c0' }}>
                {totalArrearMeso.toLocaleString()}
              </div>
            </Tooltip>
          </div>
          <div className="w-px h-11" style={{ background: 'rgba(255,255,255,.35)' }} />
          <div className="pl-8">
            <div className="text-sm" style={{ color: 'rgba(255,255,255,.85)' }}>남은 필요 메소</div>
            <Tooltip text={formatMesoKorean(totalRequiredMeso)}>
              <div className="text-xl font-bold tabular-nums mt-1 inline-block" style={{ color: '#ffe27a' }}>
                {totalRequiredMeso.toLocaleString()}
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
        </div>
        )}
      </MapleWindow>

      <SymbolLevelTableModal open={levelTableOpen} onClose={() => setLevelTableOpen(false)} allSymbols={allSymbols} />
    </div>
  )
}
