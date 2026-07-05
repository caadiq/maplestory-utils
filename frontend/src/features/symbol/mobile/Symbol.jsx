import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useSymbolStore, symbolInitialState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { useSymbolCharacterSync } from '../useSymbolCharacterSync'
import { symbolMetrics } from '../logic'
import { formatKoreanDate, TYPE_ORDER } from '../utils'
import { formatMesoKorean } from '../../../utils/formatting'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import SymbolCard from '../pc/user/SymbolCard'

export default function Symbol() {
  useFeatureSync({ feature: 'symbol', store: useSymbolStore, initial: symbolInitialState })

  const { data: allSymbols = [] } = useQuery({
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
  const selectCharacter = useSymbolStore((s) => s.selectCharacter)
  const storedTab = useSymbolStore((s) => s.selectedTabs?.[selectedCharId])
  const setTabStore = useSymbolStore((s) => s.setTab)
  const tab = storedTab || tabs[0]?.key || null
  const setTab = (t) => { if (selectedCharId) setTabStore(selectedCharId, t) }

  useSymbolCharacterSync(allSymbols)

  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const addAnchorRef = useRef(null)

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
  const isEquipped = (id) => !!progress?.[id]?.equipped
  const selectedChar = characters.find((c) => c.id === selectedCharId)
  const symbols = allSymbols.filter((s) => s.type === tab)
  const tabInfo = tabs.find((t) => t.key === tab)

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
    <div className="space-y-4">
      {/* 캐릭터 추가 */}
      <form onSubmit={handleSearch} className="flex gap-2" style={{ marginBottom: 0 }}>
        <div ref={addAnchorRef} className="relative flex-1 min-w-0">
          <input
            type="text"
            value={addName}
            onChange={(e) => { setAddName(e.target.value); if (addError) setAddError('') }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            placeholder="캐릭터 닉네임으로 장착 심볼 불러오기"
            className="w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
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
          className="rounded-lg px-5 py-2.5 text-sm font-medium shrink-0 disabled:opacity-50"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
        >
          {searchMutation.isPending ? '...' : '조회'}
        </button>
      </form>
      {addError && <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{addError}</p>}

      {/* 캐릭터 칩 (가로 스크롤, 헤더 아래 고정) */}
      {characters.length > 0 && (
        <div className="sticky top-14 z-10 -mx-4 border-b" style={{ background: 'var(--bg-from)', borderColor: 'var(--header-border)' }}>
          <OverlayScrollbarsComponent
            className="pt-2.5 pb-0"
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
            defer
          >
            <div className="flex w-max gap-2.5 px-4 pb-2.5">
              {characters.map((c) => {
                const active = c.id === selectedCharId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCharacter(c.id)}
                    className="relative shrink-0 rounded-2xl border p-2 pr-8 text-left active:scale-[0.98] transition-transform"
                    style={active
                      ? { background: 'var(--selected-bg)', borderColor: 'var(--selected-border)' }
                      : { background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--surface-nested)' }}>
                        {c.character_image
                          ? <img src={c.character_image} alt="" className="w-full h-full object-contain scale-[2.1] origin-center select-none" style={{ imageRendering: 'pixelated' }} draggable={false} loading="lazy" decoding="async" />
                          : <span className="text-xl" style={{ color: 'var(--text-dim)' }}>?</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          {c.world_icon && (
                            <img src={c.world_icon} alt="" className="w-4 h-4 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
                          )}
                          <div className="text-sm font-semibold truncate max-w-[8rem]" style={{ color: active ? 'var(--accent-bright)' : 'var(--text-strong)' }}>{c.character_name}</div>
                        </div>
                        <div className="text-[11px] truncate max-w-[8rem]" style={{ color: 'var(--text-dim)' }}>Lv.{c.character_level} · {c.job_name}</div>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); removeCharacter(c.id) }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full text-sm"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      ✕
                    </span>
                  </button>
                )
              })}
            </div>
          </OverlayScrollbarsComponent>
          {selectedCharId && tabs.length > 0 && (
            <div className="px-4 pb-2.5">
              <div className="flex gap-1 p-1 rounded-xl border" style={{ background: 'var(--surface-3)', borderColor: 'var(--panel-border)' }}>
                {tabs.map((t) => {
                  const active = tab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className="flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg"
                      style={active
                        ? { background: 'var(--selected-bg)', color: 'var(--accent-bright)' }
                        : { color: 'var(--text-muted)' }}
                    >
                      {t.image_url && <img src={t.image_url} alt="" className="w-6 h-6 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className="text-[12px] font-semibold leading-tight text-center whitespace-pre-line">{t.key.replace(' ', '\n')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedCharId ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm" style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)', color: 'var(--text-dim)' }}>
          캐릭터를 추가하고 선택해주세요
        </div>
      ) : (
        <>
          {/* 심볼 카드 리스트 */}
          <div className="space-y-3">
            {symbols.map((s) => (
              <SymbolCard key={s.id} symbol={s} equipped={isEquipped(s.id)} charId={selectedCharId} />
            ))}
          </div>

          {/* 전체 요약 */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--selected-bg)', borderColor: 'var(--selected-border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{tabInfo?.label} 전체 만렙 완료 예상일</div>
              <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--accent-bright)' }}>
                {overallDate ? formatKoreanDate(overallDate) : '-'}
              </div>
            </div>
            <div className="flex gap-4 pt-2 border-t" style={{ borderColor: 'var(--row-divider)' }}>
              <div className="flex-1">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>누적 체납 메소</div>
                <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: 'var(--danger-text)' }}>{totalArrearMeso.toLocaleString()}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{formatMesoKorean(totalArrearMeso)}</div>
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>남은 필요 메소</div>
                <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: 'var(--warning-text-bright)' }}>{totalRequiredMeso.toLocaleString()}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{formatMesoKorean(totalRequiredMeso)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
