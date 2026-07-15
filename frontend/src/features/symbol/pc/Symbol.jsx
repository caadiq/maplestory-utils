import { useState, useLayoutEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Reorder } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import Tooltip from '../../../components/common/Tooltip'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import { useSymbolStore, symbolInitialState } from '../store'
import { formatMesoKorean } from '../../../utils/formatting'
import { formatKoreanDate, TYPE_ORDER } from '../utils'
import { symbolMetrics } from '../logic'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useSymbolCharacterSync } from '../useSymbolCharacterSync'
import CharacterCard from './user/CharacterCard'
import SymbolCard from './user/SymbolCard'
import SymbolLevelTableModal from './user/SymbolLevelTableModal'

export default function Symbol() {
  useFeatureSync({ feature: 'symbol', store: useSymbolStore, initial: symbolInitialState })

  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  // 심볼 목록 (DB에서 로드)
  const { data: allSymbols = [] } = useQuery({
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
      const m = symbolMetrics({ symbol: s, progress: p, equipped: !!p?.equipped, eventSkill: selectedChar?.event_skill })
      if (!m.equipped || m.isMax) continue
      req += m.remainingMeso
      arr += m.arrearMeso
      if (!m.effectivelyMax && m.completeDate && (!latest || m.completeDate > latest)) latest = m.completeDate
    }
    return { totalRequiredMeso: req, totalArrearMeso: arr, overallDate: latest }
  }, [symbols, progress, selectedChar?.event_skill])

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      {/* 캐릭터 조회 */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
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
              placeholder="캐릭터 닉네임으로 장착 심볼 불러오기"
              className="w-full h-12 box-border rounded-lg border pl-10 pr-4 text-base outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
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
            className="shrink-0 rounded-lg disabled:opacity-50 px-6 h-12 text-base font-semibold hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {searchMutation.isPending ? '...' : '조회'}
          </button>
        </form>
        {addError && (
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{addError}</p>
        )}

        {/* 캐릭터 목록 */}
        {characters.length > 0 && (
          <OverlayScrollbarsComponent
            className="-mb-4"
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
        )}
      </div>

      {/* 심볼 타입 탭 */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setLevelTableOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--row-hover-bg)]"
            style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1.5 6H14.5M6 6V13.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            레벨별 비용표
          </button>
        </div>
        <div className="flex gap-2">
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl border px-4 py-3"
              style={active ? {
                background: 'var(--selected-bg)',
                borderColor: 'var(--selected-border)',
                color: 'var(--accent-bright)',
                boxShadow: 'var(--btn-primary-shadow)',
              } : {
                background: 'var(--panel-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
            >
              {t.image_url ? (
                <img src={t.image_url} alt="" className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <div className="w-8 h-8 rounded" style={{ background: 'var(--surface-nested)' }} />
              )}
              <span className="text-base font-semibold">{t.label}</span>
            </button>
          )
        })}
        </div>
      </div>

      {/* 심볼 카드 그리드 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((s) => (
          <SymbolCard key={s.id} symbol={s} equipped={isEquipped(s.id)} charId={selectedCharId} />
        ))}
      </div>

      {/* 전체 요약 */}
      <div
        className="rounded-2xl border p-6 flex items-center justify-between gap-6 flex-wrap"
        style={{
          background: 'var(--selected-bg)',
          borderColor: 'var(--selected-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <div>
          <div className="text-base" style={{ color: 'var(--text-muted)' }}>
            {tabInfo?.label} 전체 만렙 완료 예상일
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1.5" style={{ color: 'var(--accent-bright)' }}>
            {overallDate ? formatKoreanDate(overallDate) : '-'}
          </div>
        </div>
        <div className="flex items-center">
          <div className="text-right pr-10">
            <div className="text-base" style={{ color: 'var(--text-muted)' }}>누적 체납 메소</div>
            <Tooltip text={formatMesoKorean(totalArrearMeso)}>
              <div className="text-2xl font-bold tabular-nums mt-1 inline-block" style={{ color: 'var(--danger-text)' }}>
                {totalArrearMeso.toLocaleString()}
              </div>
            </Tooltip>
          </div>
          <div className="w-px h-12" style={{ background: 'var(--panel-border)' }} />
          <div className="text-right pl-10">
            <div className="text-base" style={{ color: 'var(--text-muted)' }}>남은 필요 메소</div>
            <Tooltip text={formatMesoKorean(totalRequiredMeso)}>
              <div className="text-2xl font-bold tabular-nums mt-1 inline-block" style={{ color: 'var(--warning-text-bright)' }}>
                {totalRequiredMeso.toLocaleString()}
              </div>
            </Tooltip>
          </div>
        </div>
      </div>

      <SymbolLevelTableModal open={levelTableOpen} onClose={() => setLevelTableOpen(false)} allSymbols={allSymbols} />
    </div>
  )
}
