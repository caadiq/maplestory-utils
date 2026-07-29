import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../../../api/client'

const TYPE_STYLE = {
  '아케인': {
    color: 'var(--symbol-arcane-text)',
    background: 'var(--symbol-arcane-bg)',
    borderColor: 'var(--symbol-arcane-border)',
  },
  '어센틱': {
    color: 'var(--symbol-authentic-text)',
    background: 'var(--symbol-authentic-bg)',
    borderColor: 'var(--symbol-authentic-border)',
  },
  '그랜드 어센틱': {
    color: 'var(--symbol-grand-text)',
    background: 'var(--symbol-grand-bg)',
    borderColor: 'var(--symbol-grand-border)',
  },
}

function SymbolCardContent({ symbol, dragging = false }) {
  const badgeStyle = TYPE_STYLE[symbol.type] || TYPE_STYLE['아케인']
  return (
    <div
      className="flex items-stretch rounded-2xl border"
      style={{
        backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
        borderColor: dragging ? 'var(--selected-border)' : 'var(--card-border)',
        boxShadow: dragging ? '0 12px 32px rgba(16, 185, 129, 0.25)' : 'var(--card-shadow)',
      }}
    >
      <div className="flex items-center px-2 cursor-grab active:cursor-grabbing" style={{ color: 'var(--text-dim)' }}>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
          <circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" />
          <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" />
          <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 min-w-0 flex items-start gap-3 p-4 pl-2">
        <div
          className="shrink-0 w-14 h-14 rounded-xl border flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))',
            borderColor: 'var(--icon-box-border)',
          }}
        >
          {symbol.image_url ? (
            <img src={symbol.image_url} alt="" className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} />
          ) : (
            <span className="text-2xl" style={{ color: 'var(--text-dim)' }}>?</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-medium truncate">{symbol.region}</h3>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
              style={badgeStyle}
            >
              {symbol.type}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>
            <span>만렙 {symbol.max_level}</span>
            <span>일퀘 {symbol.daily_default}</span>
            <span>주간퀘 {symbol.weekly_default}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableSymbolCard({ symbol }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } = useSortable({
    id: symbol.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={`relative ${isDragging ? 'opacity-30' : ''}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 z-10 cursor-grab active:cursor-grabbing rounded-l-2xl hover:bg-[var(--row-hover-bg)] transition touch-none"
        aria-label="순서 변경"
      />
      <Link to={`symbols/${symbol.id}`} className="block group hover:[&_h3]:text-[var(--accent-hover-text)] [&_h3]:transition">
        <SymbolCardContent symbol={symbol} />
      </Link>
    </div>
  )
}

export default function SymbolList() {
  const queryClient = useQueryClient()
  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['admin', 'symbol', 'symbols'],
    queryFn: () => api('/api/admin/symbol/symbols').catch(() => []),
  })

  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState(null)
  useEffect(() => { setItems(symbols) }, [symbols])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reorderMutation = useMutation({
    mutationFn: (ids) => api('/api/admin/symbol/symbols/reorder', {
      method: 'POST',
      body: { ids },
    }),
    onError: (err) => {
      alert(err.message)
      queryClient.invalidateQueries({ queryKey: ['admin', 'symbol', 'symbols'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symbol', 'symbols'] })
    },
  })

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((s) => s.id === active.id)
    const newIdx = items.findIndex((s) => s.id === over.id)
    const next = arrayMove(items, oldIdx, newIdx)
    setItems(next)
    reorderMutation.mutate(next.map((s) => s.id))
  }

  const activeSymbol = items.find((s) => s.id === activeId)

  return (
    <div className="space-y-6 pt-0">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">심볼 관리</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>심볼 정보 및 레벨별 필요 개수/메소를 관리합니다</p>
        </div>
        <Link
          to="symbols/new"
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--btn-primary-bg-hover)]"
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            boxShadow: 'var(--btn-primary-shadow)',
          }}
        >
          <span className="text-base leading-none">+</span>
          심볼 추가
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--skeleton-bg)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-16 text-center"
          style={{
            borderColor: 'var(--dashed-border)',
            background: 'var(--skeleton-bg)',
          }}
        >
          <div className="text-5xl mb-3 opacity-30">🔮</div>
          <p className="mb-4" style={{ color: 'var(--text-muted)' }}>등록된 심볼이 없습니다</p>
          <Link
            to="symbols/new"
            className="text-sm hover:text-[var(--accent-hover-text)]"
            style={{ color: 'var(--accent)' }}
          >
            첫 심볼 추가하기 →
          </Link>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <SortableSymbolCard key={s.id} symbol={s} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }}>
            {activeSymbol ? <SymbolCardContent symbol={activeSymbol} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
