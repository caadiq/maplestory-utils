import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Reorder, useDragControls } from 'framer-motion'
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
            <span className="text-gray-700 text-4xl">?</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-semibold truncate">{char.character_name}</span>
            <span className="text-xs text-gray-500 truncate">Lv.{char.character_level} · {char.job_name}</span>
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
                      <div className="aspect-square rounded bg-gray-900 overflow-hidden border border-white/5">
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
            <div className="text-xs text-gray-600 italic h-[58px] flex items-center">보스 미선택</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-2">
        <div className="flex items-baseline gap-1 tabular-nums">
          <span className={`text-base font-bold ${count > 0 ? 'text-amber-300' : 'text-gray-600'}`}>{count}</span>
          <span className="text-base font-bold text-amber-300/40">/ {MAX_PER_CHARACTER}</span>
        </div>
        <div className={`text-sm font-semibold tabular-nums whitespace-nowrap ${count > 0 ? 'text-emerald-300' : 'text-gray-700'}`}>
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
      className={`group relative rounded-xl border cursor-pointer select-none ${
        isSelected
          ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
          : 'border-white/5 hover:border-white/15 bg-gray-950/40 hover:bg-gray-950/60'
      }`}
    >
      {/* 드래그 핸들 */}
      <div
        onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
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
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100 flex items-center justify-center text-base"
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
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4 space-y-3 shrink-0">
        <div>
          <div className="text-xs text-emerald-200/80">총 주간 수익</div>
          <div ref={totalContainerRef} className="mt-1 overflow-hidden">
            <div
              ref={totalTextRef}
              className="font-bold text-emerald-300 leading-tight whitespace-nowrap inline-block"
            >
              {totalText}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
          <div className="space-y-2">
            <div className="text-sm text-gray-400">총 결정 개수</div>
            <div className="h-2 rounded-full bg-gray-900 overflow-hidden">
              <div
                className={`h-full transition-all ${totalCount > MAX_PER_ACCOUNT ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className={`text-2xl font-bold leading-none ${totalCount > MAX_PER_ACCOUNT ? 'text-red-400' : 'text-amber-300'}`}>
              {accountUsage}
            </span>
            <span className={`text-2xl font-bold leading-none ${totalCount > MAX_PER_ACCOUNT ? 'text-red-400/40' : 'text-amber-300/40'}`}>
              / {MAX_PER_ACCOUNT}
            </span>
          </div>
        </div>
        {totalCount > MAX_PER_ACCOUNT && (
          <p className="text-[10px] text-amber-400">⚠ 한도 {totalCount - MAX_PER_ACCOUNT}개 초과</p>
        )}
      </div>

      {/* 캐릭터 추가 (고정) */}
      <div className="shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
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
              className="w-full rounded-lg border-2 border-white/10 bg-gray-950 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500/60 hover:border-white/20 transition"
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-sm font-medium transition shrink-0 shadow-lg shadow-emerald-500/20"
          >
            {searchMutation.isPending ? '...' : '추가'}
          </button>
        </form>
        {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
      </div>

      {/* 캐릭터 목록 (스크롤) */}
      {characters.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4">
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
