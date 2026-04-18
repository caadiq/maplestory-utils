import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Reorder, useDragControls } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../api/client'
import ConfirmDialog from '../../../components/ConfirmDialog'
import Tooltip from '../../../components/Tooltip'
import { useFitText } from '../../../hooks/useFitText'
import { DIFFICULTIES, formatMeso, getDifficultyBadgeStyle } from '../admin/constants'

const MAX_PER_CHARACTER = 12
const MAX_PER_ACCOUNT = 90

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

  // 12개 상한은 수익 높은 순으로 취한 뒤, 표시는 보스 목록 순서대로 정렬
  const topByRevenue = [...selectedBosses].sort((a, b) => b.revenue - a.revenue).slice(0, MAX_PER_CHARACTER)
  const visibleBosses = topByRevenue.sort(
    (a, b) => (bossIndex.get(a.boss.id) ?? 0) - (bossIndex.get(b.boss.id) ?? 0)
  )
  const totalRevenue = visibleBosses.reduce((s, x) => s + x.revenue, 0)
  const count = selectedBosses.length

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
            />
          ) : (
            <span className="text-4xl" style={{ color: 'var(--text-dim)' }}>?</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-semibold truncate">{char.character_name}</span>
            <span className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
              Lv.{char.character_level} · {char.job_name}
            </span>
          </div>

          {visibleBosses.length > 0 ? (
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
                        <img src={item.boss.image_url || '/default.png'} alt="" draggable={false} className="w-full h-full object-cover select-none" />
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
          style={{ color: count > 0 ? 'var(--accent-bright)' : 'var(--text-dim)' }}
        >
          {count > 0 ? formatMeso(totalRevenue) : '-'}
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
      className="group relative rounded-xl border cursor-pointer select-none"
      style={{
        borderColor: isSelected ? 'var(--selected-border)' : 'var(--panel-border)',
        background: isSelected ? 'var(--selected-bg)' : 'var(--surface-3)',
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
  const charResults = characters.map((char) => {
    const charSel = allSelections[char.character_name] || {}
    const items = Object.entries(charSel)
      .filter(([, sel]) => sel)
      .map(([bossId, sel]) => {
        const boss = bosses.find((b) => b.id === Number(bossId))
        if (!boss) return null
        const bd = boss.difficulties.find((d) => d.difficulty === sel.difficulty)
        if (!bd) return null
        return Math.floor(bd.crystal_price / sel.party)
      })
      .filter(Boolean)
      .sort((a, b) => b - a)
      .slice(0, MAX_PER_CHARACTER)

    return { count: items.length, revenue: items.reduce((s, v) => s + v, 0) }
  })

  const totalCount = charResults.reduce((s, r) => s + r.count, 0)
  const totalRevenue = charResults.reduce((s, r) => s + r.revenue, 0)
  const accountUsage = Math.min(totalCount, MAX_PER_ACCOUNT)
  const usagePct = Math.min((accountUsage / MAX_PER_ACCOUNT) * 100, 100)
  const totalText = formatMeso(totalRevenue)
  const { containerRef: totalContainerRef, textRef: totalTextRef } = useFitText({
    maxFontSize: 32,
    minFontSize: 14,
    value: totalText,
  })

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      {/* 총 수익 카드 (고정) */}
      <div
        className="rounded-2xl border p-4 space-y-3 shrink-0"
        style={{
          borderColor: 'var(--selected-border)',
          background: 'var(--selected-bg)',
        }}
      >
        <div>
          <div className="text-xs" style={{ color: 'var(--accent-bright)' }}>총 주간 수익</div>
          <div ref={totalContainerRef} className="mt-1 overflow-hidden">
            <div
              ref={totalTextRef}
              className="font-bold leading-tight whitespace-nowrap inline-block"
              style={{ color: 'var(--accent-bright)' }}
            >
              {totalText}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
          <div className="space-y-2">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>총 결정 개수</div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--progress-track)' }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${usagePct}%`,
                  background: totalCount > MAX_PER_ACCOUNT ? 'var(--progress-amber)' : 'var(--progress-emerald)',
                }}
              />
            </div>
          </div>
          <div className="flex items-baseline gap-1 tabular-nums">
            <span
              className="text-2xl font-bold leading-none"
              style={{ color: totalCount > MAX_PER_ACCOUNT ? 'var(--danger-text)' : 'var(--warning-text-bright)' }}
            >
              {accountUsage}
            </span>
            <span
              className="text-2xl font-bold leading-none"
              style={{
                color: totalCount > MAX_PER_ACCOUNT ? 'var(--danger-text)' : 'var(--warning-text-dim)',
                opacity: totalCount > MAX_PER_ACCOUNT ? 0.4 : 1,
              }}
            >
              / {MAX_PER_ACCOUNT}
            </span>
          </div>
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
          <div className="relative flex-1 min-w-0">
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
              placeholder="캐릭터 닉네임 검색"
              className="w-full rounded-lg border-2 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--text-strong)',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="rounded-lg disabled:opacity-50 px-5 py-2.5 text-sm font-medium shrink-0 hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
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
