import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../../../api/client'
import ConfirmDialog from '../../../../components/common/ConfirmDialog'
import { PageHeader, Panel, Row, Button, Thumb, GripIcon, EmptyBox } from '../../../admin/pc/components/ui'

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

function SymbolRowContent({ symbol, index = 0, dragHandle = null, onEdit, onDelete, dragging = false }) {
  const badgeStyle = TYPE_STYLE[symbol.type] || TYPE_STYLE['아케인']
  return (
    <Row
      index={index}
      className={dragging ? 'rounded-xl' : ''}
      style={dragging ? {
        background: 'var(--mpl-card)',
        border: '1px solid var(--mpl-sky-to)',
        boxShadow: '0 10px 26px rgba(31,44,61,.22)',
      } : undefined}
    >
      <span className="shrink-0 flex items-center" style={{ color: 'var(--text-dim)' }}>
        {dragHandle ?? <GripIcon />}
      </span>
      <Thumb url={symbol.image_url} />
      <span className="flex-1 min-w-0 text-[15px] font-bold truncate" style={{ color: 'var(--text-strong)' }}>
        {symbol.region}
      </span>
      <span className="w-[128px] shrink-0">
        <span className="text-[12.5px] font-bold px-2.5 py-1 rounded border" style={badgeStyle}>{symbol.type}</span>
      </span>
      <span className="w-[76px] shrink-0 text-center text-[15px] font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>
        {symbol.max_level}
      </span>
      <span className="w-[76px] shrink-0 text-center text-[15px] font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>
        {symbol.daily_default}
      </span>
      <span className="w-[76px] shrink-0 text-center text-[15px] font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>
        {symbol.weekly_default}
      </span>
      <span className="flex items-center gap-1.5 shrink-0 ml-2">
        <Button variant="ghost" onClick={onEdit}>수정</Button>
        <Button variant="dangerGhost" onClick={onDelete}>삭제</Button>
      </span>
    </Row>
  )
}

function SortableSymbolRow({ symbol, index, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } = useSortable({
    id: symbol.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  })

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'opacity-30' : ''}>
      <SymbolRowContent
        symbol={symbol}
        index={index}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandle={(
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1"
            aria-label="순서 변경"
          >
            <GripIcon />
          </button>
        )}
      />
    </div>
  )
}

export default function SymbolList() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['admin', 'symbol', 'symbols'],
    queryFn: () => api('/api/admin/symbol/symbols').catch(() => []),
  })

  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  useEffect(() => { setItems(symbols) }, [symbols])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reorderMutation = useMutation({
    mutationFn: (ids) => api('/api/admin/symbol/symbols/reorder', { method: 'POST', body: { ids } }),
    onError: (err) => {
      alert(err.message)
      queryClient.invalidateQueries({ queryKey: ['admin', 'symbol', 'symbols'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symbol', 'symbols'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/api/admin/symbol/symbols/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'symbol', 'symbols'] })
      queryClient.invalidateQueries({ queryKey: ['symbol', 'symbols'] })
    },
    onError: (err) => alert(err.message),
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
  const edit = (id) => () => navigate(`symbols/${id}`)
  const remove = (symbol) => () => setDeleteTarget(symbol)

  return (
    <div>
      <PageHeader title="심볼 관리" description="심볼 정보 및 레벨별 필요 개수/메소를 관리합니다">
        <Button onClick={() => navigate('symbols/new')}>+ 심볼 추가</Button>
      </PageHeader>

      {isLoading ? (
        <Panel title="심볼">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse border-b last:border-b-0" style={{ background: 'var(--skeleton-bg)', borderColor: 'var(--mpl-card-line)' }} />
          ))}
        </Panel>
      ) : items.length === 0 ? (
        <EmptyBox
          icon="🔮"
          text="등록된 심볼이 없습니다"
          action={<Button onClick={() => navigate('symbols/new')}>첫 심볼 추가하기</Button>}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <Panel
            title="심볼"
            right={items.length}
            columns={(
              <>
                <span className="w-[14px] shrink-0" />
                <span className="w-[46px] shrink-0" />
                <span className="flex-1 min-w-0">지역</span>
                <span className="w-[128px] shrink-0">유형</span>
                <span className="w-[76px] shrink-0 text-center">만렙</span>
                <span className="w-[76px] shrink-0 text-center">일퀘</span>
                <span className="w-[76px] shrink-0 text-center">주간퀘</span>
                <span className="w-[136px] shrink-0" />
              </>
            )}
          >
            <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {items.map((s, i) => (
                <SortableSymbolRow key={s.id} symbol={s} index={i} onEdit={edit(s.id)} onDelete={remove(s)} />
              ))}
            </SortableContext>
          </Panel>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }}>
            {activeSymbol ? <SymbolRowContent symbol={activeSymbol} onEdit={() => {}} onDelete={() => {}} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
        title="심볼 삭제"
        description={`"${deleteTarget?.region}" 심볼을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
