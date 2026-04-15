import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const MOCK_SYMBOLS = [
  { id: 1, type: '아케인', region: '소멸의 여로', image_url: 'https://s3.caadiq.co.kr/maplestory/symbol/아케인심볼(소멸의 여로).webp', max_level: 20, daily_default: 20, weekly_default: 45 },
  { id: 2, type: '아케인', region: '츄츄 아일랜드', image_url: 'https://s3.caadiq.co.kr/maplestory/symbol/아케인심볼(츄츄 아일랜드).webp', max_level: 20, daily_default: 20, weekly_default: 45 },
  { id: 3, type: '어센틱', region: '세르니움', image_url: 'https://s3.caadiq.co.kr/maplestory/symbol/어센틱심볼(세르니움).webp', max_level: 11, daily_default: 10, weekly_default: 25 },
  { id: 4, type: '그랜드 어센틱', region: '탈라하트', image_url: 'https://s3.caadiq.co.kr/maplestory/symbol/그랜드 어센틱심볼(탈라하트).webp', max_level: 11, daily_default: 0, weekly_default: 30 },
]

const TYPE_COLOR = {
  '아케인': { text: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
  '어센틱': { text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  '그랜드 어센틱': { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
}

function SymbolCardContent({ symbol, dragging = false }) {
  const color = TYPE_COLOR[symbol.type]
  return (
    <div className={`flex items-stretch rounded-2xl border bg-gradient-to-br from-gray-900/80 to-gray-900/40 ${
      dragging
        ? 'border-emerald-500/60 shadow-2xl shadow-emerald-500/30'
        : 'border-white/5'
    }`}>
      <div className="flex items-center px-2 text-gray-700 cursor-grab active:cursor-grabbing">
        <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
          <circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" />
          <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" />
          <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 min-w-0 flex items-start gap-3 p-4 pl-2">
        <div className="shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center overflow-hidden">
          {symbol.image_url ? (
            <img src={symbol.image_url} alt="" className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} />
          ) : (
            <span className="text-gray-700 text-2xl">?</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{symbol.region}</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${color.text} ${color.bg} ${color.border}`}>
              {symbol.type}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 tabular-nums">
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
        className="absolute left-0 top-0 bottom-0 w-8 z-10 cursor-grab active:cursor-grabbing rounded-l-2xl hover:bg-white/5 transition touch-none"
        aria-label="순서 변경"
      />
      <Link to={`symbols/${symbol.id}`} className="block group hover:[&_h3]:text-emerald-300 [&_h3]:transition">
        <SymbolCardContent symbol={symbol} />
      </Link>
    </div>
  )
}

export default function SymbolList() {
  const [items, setItems] = useState(MOCK_SYMBOLS)
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((s) => s.id === active.id)
    const newIdx = items.findIndex((s) => s.id === over.id)
    setItems(arrayMove(items, oldIdx, newIdx))
  }

  const activeSymbol = items.find((s) => s.id === activeId)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">심볼 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">심볼 정보 및 레벨별 필요 개수/메소를 관리합니다</p>
        </div>
        <Link
          to="symbols/new"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium transition shadow-lg shadow-emerald-500/20"
        >
          <span className="text-base leading-none">+</span>
          심볼 추가
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
          <div className="text-5xl mb-3 opacity-30">🔮</div>
          <p className="text-gray-400 mb-4">등록된 심볼이 없습니다</p>
          <Link to="symbols/new" className="text-sm text-emerald-400 hover:text-emerald-300 transition">
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
