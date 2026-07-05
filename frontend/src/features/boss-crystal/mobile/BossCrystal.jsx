import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import { useBossStore, bossInitialState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import Select from '../../../components/common/Select'
import { DIFFICULTIES, formatMeso } from '../pc/admin/constants'
import { MAX_PER_CHARACTER, MAX_PER_ACCOUNT, LABEL_EN, charRevenue } from '../logic'
import BossPriceModal from './BossPriceModal'

export default function BossCrystal() {
  useFeatureSync({ feature: 'boss-crystal', store: useBossStore, initial: bossInitialState })

  const characters = useBossStore((s) => s.characters)
  const selectedChar = useBossStore((s) => s.selectedChar)
  const selections = useBossStore((s) => s.selections)
  const addCharacter = useBossStore((s) => s.addCharacter)
  const removeCharacter = useBossStore((s) => s.removeCharacter)
  const selectCharacter = useBossStore((s) => s.selectCharacter)
  const setBossSelection = useBossStore((s) => s.setBossSelection)

  const { data: bosses = [] } = useQuery({
    queryKey: ['boss-crystal', 'bosses'],
    queryFn: () => api('/api/boss-crystal/bosses').catch(() => []),
  })

  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const addAnchorRef = useRef(null)

  const searchMutation = useMutation({
    mutationFn: (n) => api(`/api/character/search?name=${encodeURIComponent(n)}`),
    onSuccess: (data) => {
      if (characters.find((c) => c.character_name === data.character_name)) {
        setError('이미 추가된 캐릭터입니다')
        return
      }
      addCharacter(data)
      setName('')
      setError('')
    },
    onError: (err) => setError(err.message),
  })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    searchMutation.mutate(name.trim())
  }

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
  const currentCount = Object.values(currentSel).filter(Boolean).length
  const maxReached = currentCount >= MAX_PER_CHARACTER

  const PANEL = {
    background: 'var(--panel-bg)',
    borderColor: 'var(--panel-border)',
    boxShadow: 'var(--panel-shadow)',
  }

  return (
    <div className="space-y-4">
      {/* 계정 전체 수익 요약 */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--selected-bg)', borderColor: 'var(--selected-border)' }}>
        <div className="flex items-end justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>계정 전체 주간 수익</span>
          <span
            className="text-xs tabular-nums"
            style={{ color: totalCount > MAX_PER_ACCOUNT ? 'var(--danger-text)' : 'var(--text-muted)' }}
          >
            {accountUsage} / {MAX_PER_ACCOUNT}
          </span>
        </div>
        <div className="text-2xl font-bold tabular-nums mt-1" style={{ color: 'var(--accent-bright)' }}>
          {formatMeso(totalRevenue)}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--progress-track)' }}>
          <div className="h-full transition-all" style={{ width: `${usagePct}%`, background: totalCount > MAX_PER_ACCOUNT ? 'var(--progress-red)' : 'var(--progress-emerald)' }} />
        </div>
      </div>

      {/* 캐릭터 추가 */}
      <form onSubmit={handleAdd} className="flex gap-2" style={{ marginBottom: 0 }}>
        <div ref={addAnchorRef} className="relative flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError('') }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            placeholder="캐릭터 닉네임 검색"
            className="w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
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
          className="rounded-lg px-5 py-2.5 text-sm font-medium shrink-0 disabled:opacity-50"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
        >
          {searchMutation.isPending ? '...' : '추가'}
        </button>
      </form>
      {error && <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{error}</p>}

      {/* 캐릭터 칩 (가로 스크롤) — 스크롤 시 헤더 아래 고정 */}
      {characters.length > 0 && (
        <div className="sticky top-14 z-10 -mx-4 border-b" style={{ background: 'var(--bg-from)', borderColor: 'var(--header-border)' }}>
          <OverlayScrollbarsComponent
            className="px-4 pt-2.5 pb-0"
            options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'scroll', y: 'hidden' } }}
            defer
          >
            <div className="flex gap-2.5 pb-2.5">
          {characters.map((c) => {
            const active = c.character_name === selectedChar
            const r = charRevenue(c.character_name, selections, bosses)
            return (
              <button
                key={c.character_name}
                type="button"
                onClick={() => selectCharacter(c.character_name)}
                className="relative shrink-0 rounded-2xl border p-3 pr-9 text-left active:scale-[0.98] transition-transform"
                style={active
                  ? { background: 'var(--selected-bg)', borderColor: 'var(--selected-border)' }
                  : { background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--surface-nested)' }}>
                    {c.character_image
                      ? <img src={c.character_image} alt="" className="w-full h-full object-contain scale-[2.1] origin-center select-none" style={{ imageRendering: 'pixelated' }} draggable={false} loading="lazy" decoding="async" />
                      : <span className="text-2xl" style={{ color: 'var(--text-dim)' }}>?</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      {c.world_icon && (
                        <img src={c.world_icon} alt="" className="w-5 h-5 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
                      )}
                      <div className="text-base font-semibold truncate max-w-[9rem]" style={{ color: active ? 'var(--accent-bright)' : 'var(--text-strong)' }}>{c.character_name}</div>
                    </div>
                    <div className="text-xs truncate max-w-[9rem] mt-0.5" style={{ color: 'var(--text-dim)' }}>Lv.{c.character_level} · {c.job_name}</div>
                    <div className="text-sm tabular-nums mt-1" style={{ color: r.count > 0 ? 'var(--accent-bright)' : 'var(--text-dim)' }}>
                      {r.count > 0 ? `${formatMeso(r.revenue)} · ${r.count}개` : '미선택'}
                    </div>
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); removeCharacter(c.character_name) }}
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
        </div>
      )}

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
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setPriceOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium hover:text-[var(--accent-bright)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1.5 6H14.5M6 6V13.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              전체 가격표
            </button>
            <span className="text-xs tabular-nums" style={{ color: maxReached ? 'var(--danger-text)' : 'var(--text-dim)' }}>
              {currentCount} / {MAX_PER_CHARACTER}
            </span>
          </div>
          {bosses.map((boss) => {
            const availableDiffs = DIFFICULTIES.filter((d) => boss.difficulties.some((bd) => bd.difficulty === d.key))
            const sel = currentSel[boss.id]
            const bdInfo = sel ? boss.difficulties.find((bd) => bd.difficulty === sel.difficulty) : null
            const partyN = sel?.party || 1
            const revenue = bdInfo ? Math.floor(bdInfo.crystal_price / partyN) : 0
            const disabled = maxReached && !sel
            const partyOptions = Array.from({ length: boss.max_party_size }, (_, i) => i + 1).map((n) => ({ value: n, label: `${n}인` }))

            return (
              <div
                key={boss.id}
                className="rounded-xl border p-3"
                style={{ ...PANEL, opacity: disabled ? 'var(--disabled-opacity)' : 1, pointerEvents: disabled ? 'none' : 'auto' }}
              >
                {/* 보스 이미지 + 이름 + 수익 */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: 'var(--surface-nested)' }}>
                    <img src={boss.image_url || '/default.png'} alt={boss.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-semibold flex-1 truncate">{boss.name}</span>
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
        </div>
      )}

      <BossPriceModal open={priceOpen} onClose={() => setPriceOpen(false)} bosses={bosses} />
    </div>
  )
}
