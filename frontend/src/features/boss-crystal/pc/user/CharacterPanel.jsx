import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Reorder, useDragControls } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../../api/client'
import ConfirmDialog from '../../../../components/common/ConfirmDialog'
import Tooltip from '../../../../components/common/Tooltip'
import CharacterSuggestDropdown from '../../../../components/common/CharacterSuggestDropdown'
import { useFitText } from '../../../../hooks/useFitText'
import { DIFFICULTIES, formatMeso, getDifficultyBadgeStyle } from '../admin/constants'
import { MAX_PER_CHARACTER, MAX_PER_ACCOUNT, charRevenue, isSeasonActive } from '../../logic'

/** 이름·레벨·직업 줄 — 항상 전체 텍스트 호버 툴팁 표시 */
function NameLine({ char }) {
  return (
    <div
      data-tooltip={[char.world_name, `${char.character_name} · Lv.${char.character_level} · ${char.job_name}`]
        .filter(Boolean).join(' · ')}
      className="flex items-baseline gap-2 min-w-0"
    >
      {char.world_icon && (
        <img
          src={char.world_icon}
          alt=""
          className="w-5 h-5 shrink-0 object-contain self-center"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
      <span className="truncate text-base font-semibold">{char.character_name}</span>
      <span className="truncate text-xs" style={{ color: 'var(--text-dim)' }}>
        Lv.{char.character_level} · {char.job_name}
      </span>
    </div>
  )
}

function CharacterContent({ char, selections, bosses }) {
  const bossIndex = new Map(bosses.map((b, i) => [b.id, i]))
  const selectedBosses = Object.entries(selections || {})
    .filter(([, sel]) => sel)
    .map(([bossId, sel]) => {
      const boss = bosses.find((b) => b.id === Number(bossId))
      if (!boss) return null
      const bd = boss.difficulties.find((d) => d.difficulty === sel.difficulty)
      if (!bd) return null
      return {
        boss,
        difficulty: sel.difficulty,
        revenue: Math.floor(bd.crystal_price / sel.party),
      }
    })
    .filter(Boolean)

  // 시즌보스(활성 시즌만)는 결정석 한도 미포함 — 별도로 분리해 맨 앞에 표시
  const seasonSelected = selectedBosses.filter((x) => x.boss.season && isSeasonActive(x.boss))
  const normalSelected = selectedBosses.filter((x) => !x.boss.season)

  // 12개 상한은 수익 높은 순으로 취한 뒤, 표시는 보스 목록 순서대로 정렬
  const topByRevenue = [...normalSelected].sort((a, b) => b.revenue - a.revenue).slice(0, MAX_PER_CHARACTER)
  const sorted = topByRevenue.sort(
    (a, b) => (bossIndex.get(a.boss.id) ?? 0) - (bossIndex.get(b.boss.id) ?? 0)
  )
  const visibleBosses = sorted
  const totalRevenue = [...seasonSelected, ...sorted].reduce((s, x) => s + x.revenue, 0)
  const hasAny = seasonSelected.length > 0 || sorted.length > 0
  const count = normalSelected.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 96, height: 96 }}>
          {char.character_image ? (
            <img
              src={char.character_image}
              alt=""
              className="w-full h-full object-contain scale-[3] origin-center select-none"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-4xl" style={{ color: 'var(--text-dim)' }}>?</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <NameLine char={char} />

          {hasAny ? (
            <div className="space-y-1.5">
            {visibleBosses.length > 0 && (
            <div className="grid grid-cols-6 gap-1.5">
              {visibleBosses.map((item) => {
                const diff = DIFFICULTIES.find((d) => d.key === item.difficulty)
                return (
                  <Tooltip
                    key={item.boss.id}
                    text={`${diff?.label || ''} ${item.boss.name} · ${formatMeso(item.revenue)}`}
                  >
                    <div className="space-y-0.5">
                      <div
                        className="aspect-square rounded overflow-hidden border"
                        style={{
                          background: 'var(--surface-nested)',
                          borderColor: 'var(--panel-border)',
                        }}
                      >
                        <img src={item.boss.image_url || '/default.png'} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover select-none" />
                      </div>
                      <div className="flex justify-center">
                        <div
                          className="text-[9px] font-bold leading-none rounded border w-3.5 h-3.5 flex items-center justify-center"
                          style={getDifficultyBadgeStyle(item.difficulty)}
                        >
                          {diff?.initial}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
            )}
            {/* 시즌보스 줄 — 결정석 한도와 별개라 12개 그리드와 분리 */}
            {seasonSelected.length > 0 && (
            <div className="grid grid-cols-6 gap-1.5">
              {seasonSelected.map((item) => {
                const diff = DIFFICULTIES.find((d) => d.key === item.difficulty)
                return (
                  <Tooltip
                    key={item.boss.id}
                    text={`시즌보스 · ${diff?.label || ''} ${item.boss.name} · ${formatMeso(item.revenue)}`}
                  >
                    <div className="space-y-0.5">
                      <div
                        className="aspect-square rounded overflow-hidden border-2"
                        style={{
                          background: 'var(--surface-nested)',
                          borderColor: '#eec584',
                          boxShadow: '0 0 5px rgba(238,197,132,.55)',
                        }}
                      >
                        <img src={item.boss.image_url || '/default.png'} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover select-none" />
                      </div>
                      <div className="flex justify-center">
                        <div
                          className="text-[9px] font-bold leading-none rounded border w-3.5 h-3.5 flex items-center justify-center"
                          style={getDifficultyBadgeStyle(item.difficulty)}
                        >
                          {diff?.initial}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                )
              })}
              <div
                className="flex items-center"
                style={{ gridColumn: `span ${Math.max(1, 6 - seasonSelected.length)}` }}
              >
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold leading-none"
                  style={{
                    background: 'linear-gradient(180deg, #f7dcab, #eec584)',
                    boxShadow: 'inset 0 0 0 1px #e3b878',
                    color: '#9a6a10',
                  }}
                >
                  시즌보스
                </span>
              </div>
            </div>
            )}
            </div>
          ) : (
            <div
              className="text-xs italic h-[58px] flex items-center"
              style={{ color: 'var(--text-dim)' }}
            >
              보스 미선택
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between border-t pt-2"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <div className="flex items-baseline gap-1 tabular-nums">
          <span
            className="text-base font-bold"
            style={{ color: count > 0 ? 'var(--warning-text-bright)' : 'var(--text-dim)' }}
          >
            {count}
          </span>
          <span
            className="text-base font-bold"
            style={{ color: count > 0 ? 'var(--warning-text-dim)' : 'var(--text-dim)' }}
          >
            / {MAX_PER_CHARACTER}
          </span>
        </div>
        <div
          className="text-sm font-semibold tabular-nums whitespace-nowrap"
          style={{ color: hasAny ? 'var(--accent-bright)' : 'var(--text-dim)' }}
        >
          {hasAny ? formatMeso(totalRevenue) : '-'}
        </div>
      </div>
    </div>
  )
}

function CharacterItem({ char, isSelected, selections, bosses, onSelect, onRemove }) {
  const [dragged, setDragged] = useState(false)
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={char}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => setDragged(true)}
      onDragEnd={() => {
        // 다음 click 이벤트 후에 reset
        setTimeout(() => setDragged(false), 0)
      }}
      onClick={(e) => {
        if (dragged) return
        if (e.target.closest('button')) return
        onSelect(char.character_name)
      }}
      className="group relative rounded-xl cursor-pointer select-none"
      style={{
        background: 'var(--mpl-card)',
        boxShadow: isSelected
          ? 'inset 0 0 0 2.5px var(--selected-border), 0 3px 10px rgba(134,201,62,.25)'
          : 'inset 0 0 0 1px var(--mpl-card-line)',
      }}
    >
      {/* 드래그 핸들 */}
      <div
        onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none', color: 'var(--text-dim)' }}
      >
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.2" />
          <circle cx="9" cy="3" r="1.2" />
          <circle cx="3" cy="8" r="1.2" />
          <circle cx="9" cy="8" r="1.2" />
          <circle cx="3" cy="13" r="1.2" />
          <circle cx="9" cy="13" r="1.2" />
        </svg>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(char) }}
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-base hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)]"
        style={{ color: 'var(--text-dim)' }}
        aria-label="삭제"
      >
        ×
      </button>

      <div className="pl-8 pr-3 py-2.5">
        <CharacterContent char={char} selections={selections} bosses={bosses} />
      </div>
    </Reorder.Item>
  )
}

export default function CharacterPanel({
  characters, selectedName, allSelections, bosses,
  onSelect, onAdd, onRemove, onReorder,
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const addAnchorRef = useRef(null)

  const searchMutation = useMutation({
    mutationFn: (n) => api(`/api/character/search?name=${encodeURIComponent(n)}`),
    onSuccess: (data) => {
      if (characters.find((c) => c.character_name === data.character_name)) {
        setError('이미 추가된 캐릭터입니다')
        return
      }
      onAdd(data)
      setName('')
      setError('')
    },
    onError: (err) => setError(err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    searchMutation.mutate(name.trim())
  }

  // 총합 계산
  const charResults = characters.map((char) => charRevenue(char.character_name, allSelections, bosses))

  const totalCount = charResults.reduce((s, r) => s + r.count, 0)
  const totalRevenue = charResults.reduce((s, r) => s + r.revenue, 0)
  const accountUsage = Math.min(totalCount, MAX_PER_ACCOUNT)
  const usagePct = Math.min((accountUsage / MAX_PER_ACCOUNT) * 100, 100)
  const totalText = formatMeso(totalRevenue)
  const { containerRef: totalContainerRef, textRef: totalTextRef } = useFitText({
    maxFontSize: 22,
    minFontSize: 14,
    value: totalText,
  })

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      {/* 총 수익 (메소 코인 필 + CRYSTAL 게이지) */}
      <div className="shrink-0 space-y-2.5">
        <div
          className="flex items-center gap-2.5 rounded-full pl-4 pr-5 py-2.5"
          style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
        >
          <span
            className="w-[22px] h-[22px] rounded-full shrink-0"
            style={{
              background: 'radial-gradient(circle at 35% 30%, #ffe98a, #f5b60d 65%, #d0920a)',
              boxShadow: 'inset 0 -2px 3px rgba(160,110,0,.4)',
            }}
          />
          <div ref={totalContainerRef} className="flex-1 min-w-0 overflow-hidden">
            <div
              ref={totalTextRef}
              className="font-bold leading-tight whitespace-nowrap inline-block tabular-nums"
              style={{ color: 'var(--text-strong)' }}
            >
              {totalText}
            </div>
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-dim)' }}>총 주간 수익</span>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold" style={{ color: 'var(--text-dim)', letterSpacing: '1px' }}>CRYSTAL</span>
          <span
            className="rounded-full px-3.5 py-0.5 text-sm font-bold tabular-nums"
            style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
          >
            <span style={{ color: totalCount > MAX_PER_ACCOUNT ? 'var(--danger-text)' : 'var(--accent-bright)' }}>
              {accountUsage}
            </span>
            <span style={{ color: 'var(--text-dim)' }}> / {MAX_PER_ACCOUNT}</span>
          </span>
        </div>
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{ background: 'var(--progress-track)', boxShadow: 'inset 0 1px 2px rgba(44,55,69,.12)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${usagePct}%`,
              background: totalCount > MAX_PER_ACCOUNT
                ? 'linear-gradient(180deg, #f5b04a, #e08700)'
                : 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
            }}
          />
        </div>
        {totalCount > MAX_PER_ACCOUNT && (
          <p className="text-[10px]" style={{ color: 'var(--warning-text)' }}>
            ⚠ 한도 {totalCount - MAX_PER_ACCOUNT}개 초과
          </p>
        )}
      </div>

      {/* 캐릭터 추가 (고정) */}
      <div className="shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div ref={addAnchorRef} className="relative flex-1 min-w-0">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--input-icon)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError('') }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="캐릭터 닉네임 검색"
              className="w-full rounded-full border-2 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--text-strong)',
              }}
            />
            <CharacterSuggestDropdown
              open={dropdownOpen}
              filter={name}
              anchorRef={addAnchorRef}
              excludeNames={characters.map((c) => c.character_name)}
              onSelect={(n) => {
                setName(n)
                setDropdownOpen(false)
                setError('')
                searchMutation.mutate(n)
              }}
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="rounded-full disabled:opacity-50 px-5 py-2.5 text-sm font-bold shrink-0 hover:brightness-105"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
              color: '#ffffff',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.2)',
            }}
          >
            {searchMutation.isPending ? '...' : '추가'}
          </button>
        </form>
        {error && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--danger-text)' }}>{error}</p>
        )}
      </div>

      {/* 캐릭터 목록 (스크롤) */}
      {characters.length > 0 && (
        <OverlayScrollbarsComponent
          className="flex-1 min-h-0 -mx-4"
          options={{
            scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 },
          }}
          defer
        >
          <div className="px-4">
            <Reorder.Group
              axis="y"
              values={characters}
              onReorder={onReorder}
              className="space-y-2"
            >
              {characters.map((char) => (
                <CharacterItem
                  key={char.character_name}
                  char={char}
                  isSelected={selectedName === char.character_name}
                  selections={allSelections[char.character_name] || {}}
                  bosses={bosses}
                  onSelect={onSelect}
                  onRemove={setConfirmRemove}
                />
              ))}
            </Reorder.Group>
          </div>
        </OverlayScrollbarsComponent>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          onRemove(confirmRemove.character_name)
          setConfirmRemove(null)
        }}
        title="캐릭터 삭제"
        description={confirmRemove ? `"${confirmRemove.character_name}" 캐릭터를 목록에서 삭제하시겠습니까?\n\n저장된 보스 선택도 함께 삭제됩니다.` : ''}
        confirmText="삭제"
        destructive
      />
    </div>
  )
}
