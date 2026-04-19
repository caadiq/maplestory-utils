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
import { api } from '../../../api/client'
import Tooltip from '../../../components/Tooltip'
import { DIFFICULTIES, formatMeso, getDifficultyBadgeStyle } from './constants'

function BossCardContent({ boss, dragging = false }) {
  return (
    <div
      className="flex items-stretch rounded-2xl border"
      style={{
        backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
        borderColor: dragging ? 'var(--selected-border)' : 'var(--card-border)',
        boxShadow: dragging ? '0 12px 32px rgba(16, 185, 129, 0.25)' : 'var(--card-shadow)',
      }}
    >
      {/* 핸들 자리 */}
      <div className="flex items-center px-2 cursor-grab active:cursor-grabbing" style={{ color: 'var(--text-dim)' }}>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="4" cy="10" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="4" cy="16" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
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
          <img src={boss.image_url || '/default.png'} alt={boss.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-medium truncate">{boss.name}</h3>
            <span className="text-xs shrink-0" style={{ color: 'var(--text-dim)' }}>최대 {boss.max_party_size}인</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {DIFFICULTIES.filter((d) => boss.difficulties?.some((bd) => bd.difficulty === d.key)).map((d) => {
              const bd = boss.difficulties.find((x) => x.difficulty === d.key)
              return (
                <Tooltip key={d.key} text={`${d.label} · ${formatMeso(bd.crystal_price)}`}>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                    style={getDifficultyBadgeStyle(d.key)}
                  >
                    {d.label}
                  </span>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableBossCard({ boss }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } = useSortable({
    id: boss.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 z-10 cursor-grab active:cursor-grabbing rounded-l-2xl hover:bg-[var(--row-hover-bg)] transition touch-none"
        aria-label="순서 변경"
      />
      <Link to={`bosses/${boss.id}`} className="block group hover:[&_h3]:text-[var(--accent-hover-text)] [&_h3]:transition">
        <BossCardContent boss={boss} />
      </Link>
    </div>
  )
}

export default function BossList() {
  const queryClient = useQueryClient()
  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ['admin', 'boss-crystal', 'bosses'],
    queryFn: () => api('/api/admin/boss-crystal/bosses').catch(() => []),
  })

  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState(null)

  useEffect(() => { setItems(bosses) }, [bosses])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reorderMutation = useMutation({
    mutationFn: (ids) => api('/api/admin/boss-crystal/bosses/reorder', {
      method: 'POST',
      body: { ids },
    }),
    onError: (err) => {
      alert(err.message)
      queryClient.invalidateQueries({ queryKey: ['admin', 'boss-crystal', 'bosses'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boss-crystal'] })
    },
  })

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIdx = items.findIndex((b) => b.id === active.id)
    const newIdx = items.findIndex((b) => b.id === over.id)
    const next = arrayMove(items, oldIdx, newIdx)
    setItems(next)
    reorderMutation.mutate(next.map((b) => b.id))
  }

  const activeBoss = items.find((b) => b.id === activeId)

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">보스 결정 관리</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>보스 정보 및 난이도별 결정 가격을 관리합니다</p>
        </div>
        <Link
          to="bosses/new"
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--btn-primary-bg-hover)]"
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            boxShadow: 'var(--btn-primary-shadow)',
          }}
        >
          <span className="text-base leading-none">+</span>
          보스 추가
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--skeleton-bg)' }} />
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
          <div className="text-5xl mb-3 opacity-30">⚔️</div>
          <p className="mb-4" style={{ color: 'var(--text-muted)' }}>등록된 보스가 없습니다</p>
          <Link
            to="bosses/new"
            className="text-sm hover:text-[var(--accent-hover-text)]"
            style={{ color: 'var(--accent)' }}
          >
            첫 보스 추가하기 →
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
          <SortableContext items={items.map((b) => b.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((boss) => (
                <SortableBossCard key={boss.id} boss={boss} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
            }}
          >
            {activeBoss ? <BossCardContent boss={activeBoss} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
