import { useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { useQuery, useQueries, useMutation } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import Tooltip from '../../../components/common/Tooltip'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import { useSymbolStore } from '../store'
import { formatMesoKorean } from '../../../utils/formatting'
import { formatKoreanDate, computeCompletion, TYPE_ORDER, eventBonusForType } from '../utils'
import CharacterCard from './user/CharacterCard'
import SymbolCard from './user/SymbolCard'

export default function Symbol() {
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
  const syncCharacterSymbols = useSymbolStore((s) => s.syncCharacterSymbols)
  const updateCharacter = useSymbolStore((s) => s.updateCharacter)
  const storedTab = useSymbolStore((s) => s.selectedTabs?.[selectedCharId])
  const setTabStore = useSymbolStore((s) => s.setTab)

  const tab = storedTab || tabs[0]?.key || null
  const setTab = (t) => { if (selectedCharId) setTabStore(selectedCharId, t) }

  // 각 캐릭터 기본정보(코디 이미지) 새로고침
  const basicQueries = useQueries({
    queries: useMemo(() => characters.map((c) => ({
      queryKey: ['character', 'basic', c.character_name],
      queryFn: () => api(`/api/character/search?name=${encodeURIComponent(c.character_name)}`),
      enabled: !!c.character_name,
      refetchOnMount: 'always',
      staleTime: 0,
      retry: false,
    })), [characters]),
  })
  useEffect(() => {
    // 인덱스가 아닌 character_name으로 매칭 (캐릭터 추가/삭제 시 순서 어긋남 방지)
    const byName = {}
    for (const q of basicQueries) {
      const d = q?.data
      if (d?.character_name) byName[d.character_name] = d
    }
    characters.forEach((c) => {
      const d = byName[c.character_name]
      if (!d) return
      if (d.character_image !== c.character_image || d.character_level !== c.character_level || d.job_name !== c.job_name) {
        updateCharacter(c.id, {
          character_image: d.character_image,
          character_level: d.character_level,
          job_name: d.job_name,
          world_name: d.world_name,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicQueries.map((q) => q.dataUpdatedAt).join(',')])

  // 각 캐릭터의 장착 심볼 fetch (새로고침마다 갱신)
  const symbolQueries = useQueries({
    queries: useMemo(() => characters.map((c) => ({
      queryKey: ['character', 'symbols', c.id],
      queryFn: () => api(`/api/character/symbols?ocid=${c.id}`),
      enabled: !!c.id,
      refetchOnMount: 'always',
      staleTime: 0,
    })), [characters]),
  })

  // symbolQueries 결과를 store로 반영
  useEffect(() => {
    if (!allSymbols.length || !characters.length) return
    const lookup = {}
    for (const s of allSymbols) lookup[`${s.type}|${s.region}`] = s
    // 인덱스가 아닌 응답의 ocid로 매칭 (캐릭터 추가/삭제 시 순서 어긋남 방지)
    const byOcid = {}
    for (const q of symbolQueries) {
      const d = q?.data
      if (d?.ocid) byOcid[d.ocid] = d
    }
    characters.forEach((c) => {
      const d = byOcid[c.id]
      if (!d?.symbols) return
      const equippedMap = {}
      for (const es of d.symbols) {
        const match = lookup[`${es.type}|${es.region}`]
        if (!match) continue
        equippedMap[match.id] = {
          level: es.level,
          growth: es.growth_count,
          require_growth: es.require_growth_count,
        }
      }
      syncCharacterSymbols(c.id, equippedMap)
      const nextEs = d.event_skill ?? null
      const prevEs = c.event_skill ?? null
      if (JSON.stringify(nextEs) !== JSON.stringify(prevEs)) {
        updateCharacter(c.id, { event_skill: nextEs })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSymbols, symbolQueries.map((q) => q.dataUpdatedAt).join(',')])

  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

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
      if (!p?.equipped) continue
      if (p.level >= s.max_level) continue
      let lv = p.level, g = p.growth || 0
      while (lv < s.max_level) {
        const r = s.levels?.find((l) => l.level === lv)?.required_count
        if (!r || g < r) break
        g -= r; lv += 1
      }
      const effMax = lv >= s.max_level

      let arrLv = p.level, arrG = p.growth || 0
      while (arrLv < s.max_level) {
        const lv2 = s.levels?.find((x) => x.level === arrLv)
        if (!lv2 || arrG < lv2.required_count) break
        arr += lv2.meso_cost
        arrG -= lv2.required_count
        arrLv += 1
      }
      let remaining = 0
      let gg = p.growth || 0
      for (const l of s.levels || []) {
        if (l.level < p.level) continue
        remaining += Math.max(l.required_count - gg, 0)
        gg = Math.max(gg - l.required_count, 0)
        req += l.meso_cost
      }
      if (effMax) continue
      const bonus = eventBonusForType(selectedChar?.event_skill, s.type)
      const dailyValue = p.daily !== undefined ? p.daily : (s.daily_default ?? 0) + bonus
      const { date } = computeCompletion({
        remainingSymbols: remaining,
        daily: dailyValue,
        weeklyPerWeek: (p.weeklyCount ?? 3) * (s.weekly_default || 0),
        extra: p.extra || 0,
        dailyDone: !!p.dailyDone,
      })
      if (date && (!latest || date > latest)) latest = date
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
          <div className="relative flex-1">
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
          <div className="flex items-start gap-3 overflow-x-auto pt-1">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                char={c}
                active={c.id === selectedCharId}
                onSelect={() => selectCharacter(c.id)}
                onRemove={() => removeCharacter(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 심볼 타입 탭 */}
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
    </div>
  )
}
