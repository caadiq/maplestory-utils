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
import Tooltip from '../../../../components/common/Tooltip'
import ConfirmDialog from '../../../../components/common/ConfirmDialog'
import { PageHeader, Panel, Row, Button, Thumb, GripIcon, EmptyBox } from '../../../admin/pc/components/ui'
import { DIFFICULTIES, formatMeso, getDifficultyBadgeStyle } from './constants'

/** 한 행의 내용 — 드래그 오버레이에서도 같은 모양을 쓴다 */
function BossRowContent({ boss, index = 0, dragHandle = null, onEdit, onDelete, dragging = false, divider = true }) {
  const used = DIFFICULTIES.filter((d) => boss.difficulties?.some((bd) => bd.difficulty === d.key))
  const top = boss.difficulties?.reduce(
    (max, bd) => (bd.crystal_price > (max?.crystal_price ?? -1) ? bd : max),
    null
  )

  return (
    <Row
      index={index}
      divider={divider}
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
      <Thumb url={boss.image_url} />
      <span className="w-[210px] shrink-0 flex items-center gap-1.5 min-w-0">
        <span className="text-[15px] font-bold truncate" style={{ color: 'var(--text-strong)' }}>{boss.name}</span>
        {boss.season && (
          <span
            className="shrink-0 rounded px-2 py-0.5 text-[12.5px] font-bold"
            style={{ background: 'linear-gradient(180deg, #f7dcab, #eec584)', color: '#6b4b00' }}
          >
            {boss.season.season_number}시즌
          </span>
        )}
      </span>
      <span className="w-[84px] shrink-0 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
        최대 {boss.max_party_size}인
      </span>
      <span className="flex-1 flex flex-wrap items-center gap-1 min-w-0">
        {used.map((d) => {
          const bd = boss.difficulties.find((x) => x.difficulty === d.key)
          return (
            <Tooltip key={d.key} text={`${d.label} · ${formatMeso(bd.crystal_price)}`}>
              <span className="text-[12.5px] font-bold px-2.5 py-1 rounded border" style={getDifficultyBadgeStyle(d.key)}>
                {d.label}
              </span>
            </Tooltip>
          )
        })}
      </span>
      <span className="w-[124px] shrink-0 text-right text-[15px] font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>
        {top ? formatMeso(top.crystal_price) : '-'}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" onClick={onEdit}>수정</Button>
        <Button variant="dangerGhost" onClick={onDelete}>삭제</Button>
      </span>
    </Row>
  )
}

function SortableBossRow({ boss, index, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } = useSortable({
    id: boss.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  })

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'opacity-30' : ''}>
      <BossRowContent
        boss={boss}
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

export default function BossList() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ['admin', 'boss-crystal', 'bosses'],
    queryFn: () => api('/api/admin/boss-crystal/bosses').catch(() => []),
  })

  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { setItems(bosses) }, [bosses])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reorderMutation = useMutation({
    mutationFn: (ids) => api('/api/admin/boss-crystal/bosses/reorder', { method: 'POST', body: { ids } }),
    onError: (err) => {
      alert(err.message)
      queryClient.invalidateQueries({ queryKey: ['admin', 'boss-crystal', 'bosses'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boss-crystal'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/api/admin/boss-crystal/bosses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'boss-crystal', 'bosses'] })
      queryClient.invalidateQueries({ queryKey: ['boss-crystal'] })
    },
    onError: (err) => alert(err.message),
  })

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const normal = items.filter((b) => !b.season)
    const oldIdx = normal.findIndex((b) => b.id === active.id)
    const newIdx = normal.findIndex((b) => b.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(normal, oldIdx, newIdx)
    setItems([...items.filter((b) => b.season), ...next])
    reorderMutation.mutate(next.map((b) => b.id))
  }

  const activeBoss = items.find((b) => b.id === activeId)
  const seasonItems = items.filter((b) => b.season)
  const normalItems = items.filter((b) => !b.season)
  const edit = (id) => () => navigate(`bosses/${id}`)
  const remove = (boss) => () => setDeleteTarget(boss)

  return (
    <div>
      <PageHeader title="보스 결정 관리" description="보스 정보 및 난이도별 결정 가격을 관리합니다">
        <Button onClick={() => navigate('bosses/new')}>+ 보스 추가</Button>
      </PageHeader>

      {isLoading ? (
        <Panel title="보스">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse border-b last:border-b-0" style={{ background: 'var(--skeleton-bg)', borderColor: 'var(--mpl-card-line)' }} />
          ))}
        </Panel>
      ) : items.length === 0 ? (
        <EmptyBox
          icon="⚔️"
          text="등록된 보스가 없습니다"
          action={<Button onClick={() => navigate('bosses/new')}>첫 보스 추가하기</Button>}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          {seasonItems.length > 0 && (
            <Panel
              title="시즌보스"
              right={seasonItems.length}
              columns={(
                <>
                  <span className="w-[14px] shrink-0" />
                  <span className="w-[46px] shrink-0" />
                  <span className="w-[210px] shrink-0">보스</span>
                  <span className="w-[84px] shrink-0">인원</span>
                  <span className="flex-1">난이도</span>
                  <span className="w-[124px] shrink-0 text-right">결정 가격</span>
                  <span className="w-[124px] shrink-0" />
                </>
              )}
            className="mb-3"
            >
              {seasonItems.map((boss, i) => (
                <BossRowContent
                  key={boss.id}
                  boss={boss}
                  index={i}
                  onEdit={edit(boss.id)}
                  onDelete={remove(boss)}
                  divider={false}
                  dragHandle={<span className="w-3.5" />}
                />
              ))}
            </Panel>
          )}

          <Panel
            title="일반 보스"
            right={normalItems.length}
            columns={(
              <>
                <span className="w-[14px] shrink-0" />
                <span className="w-[46px] shrink-0" />
                <span className="w-[210px] shrink-0">보스</span>
                <span className="w-[84px] shrink-0">인원</span>
                <span className="flex-1">난이도</span>
                <span className="w-[124px] shrink-0 text-right">결정 가격</span>
                <span className="w-[124px] shrink-0" />
              </>
            )}
          >
            <SortableContext items={normalItems.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {normalItems.map((boss, i) => (
                <SortableBossRow key={boss.id} boss={boss} index={i} onEdit={edit(boss.id)} onDelete={remove(boss)} />
              ))}
            </SortableContext>
          </Panel>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }}>
            {activeBoss ? <BossRowContent boss={activeBoss} onEdit={() => {}} onDelete={() => {}} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
        title="보스 삭제"
        description={`"${deleteTarget?.name}" 보스를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
