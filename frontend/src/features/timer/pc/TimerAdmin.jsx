import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Reorder, useDragControls } from 'framer-motion'
import { api } from '../../../api/client'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import Select from '../../../components/common/Select'
import { PageHeader, Panel, Button, EmptyBox, GripIcon } from '../../admin/pc/components/ui'

/**
 * 재획 타이머 알림음 관리.
 *
 * 예전에는 음원이 프론트엔드 번들에 들어 있어 하나 추가하려면 코드를 고치고 다시 빌드해야 했다.
 * 여기서 올린 음원은 RustFS에 저장되고 사용자 화면의 드롭다운에 바로 나온다.
 *
 * 이름은 따로 정하지 않는다 — 사용자에게는 순서대로 "알림 1, 2 …"로 보이고,
 * 여기 목록의 파일명은 어떤 파일인지 알아보기 위한 것이다.
 * 종류(알림음/음성)는 사용자 드롭다운에서 구분선으로 갈라 보여주려고 나눈다.
 */

const KIND_OPTIONS = [
  { value: 'alarm', label: '알림음' },
  { value: 'tts', label: '음성' },
]

export default function TimerAdmin() {
  const queryClient = useQueryClient()
  const [ordered, setOrdered] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [playingKey, setPlayingKey] = useState(null)
  const audioRef = useRef(null)

  const { data: sounds = [], isLoading } = useQuery({
    queryKey: ['admin', 'timer', 'sounds'],
    queryFn: () => api('/api/admin/timer/sounds'),
  })

  // 드래그 중에는 서버 순서로 되돌리지 않도록, 목록이 실제로 바뀔 때만 반영한다
  useEffect(() => {
    setOrdered((prev) => {
      const same = prev.length === sounds.length
        && prev.every((p, i) => p.id === sounds[i].id && p.kind === sounds[i].kind)
      return same ? prev : sounds
    })
  }, [sounds])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'timer', 'sounds'] })

  const patch = useMutation({
    mutationFn: ({ id, ...body }) => api(`/api/admin/timer/sounds/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id) => api(`/api/admin/timer/sounds/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setConfirmDelete(null); invalidate() },
  })
  const reorder = useMutation({
    mutationFn: (ids) => api('/api/admin/timer/sounds/reorder', { method: 'POST', body: { ids } }),
    onSuccess: invalidate,
  })

  const preview = (s) => {
    audioRef.current?.pause()
    if (playingKey === s.key) { setPlayingKey(null); return }
    const audio = new Audio(s.url)
    audio.onended = () => setPlayingKey(null)
    audio.play().catch(() => setPlayingKey(null))
    audioRef.current = audio
    setPlayingKey(s.key)
  }

  // 사용자에게 보일 번호 — 종류별로 따로 센다 (드롭다운 표기와 같은 규칙)
  const counts = { alarm: 0, tts: 0 }
  const labels = ordered.map((s) => {
    const kind = s.kind === 'tts' ? 'tts' : 'alarm'
    counts[kind] += 1
    return `${kind === 'tts' ? '음성' : '알림'} ${counts[kind]}`
  })

  return (
    <div className="max-w-[700px] mx-auto">
      <PageHeader
        title="알림음 관리"
        description="재획 타이머에서 고를 수 있는 소리입니다. 사용자에게는 순서대로 번호가 붙습니다"
      >
        <Button onClick={() => setUploadOpen(true)}>+ 추가</Button>
      </PageHeader>

      {isLoading ? null : ordered.length === 0 ? (
        <EmptyBox
          icon="🔔"
          text="등록된 알림음이 없습니다"
          action={<Button onClick={() => setUploadOpen(true)}>첫 알림음 올리기</Button>}
        />
      ) : (
        <Panel columns={(
          <>
            <span className="w-[16px]" />
            <span className="w-[58px]">표시</span>
            <span className="w-[92px]">종류</span>
            <span className="flex-1">파일</span>
            <span className="w-[62px]" />
          </>
        )}>
          <Reorder.Group as="div" axis="y" values={ordered} onReorder={setOrdered}>
            {ordered.map((s, i) => (
              <SoundRow
                key={s.id}
                sound={s}
                label={labels[i]}
                index={i}
                playing={playingKey === s.key}
                onPreview={() => preview(s)}
                onKind={(kind) => kind !== s.kind && patch.mutate({ id: s.id, kind })}
                onDelete={() => setConfirmDelete(s)}
                onDragDone={() => reorder.mutate(ordered.map((x) => x.id))}
              />
            ))}
          </Reorder.Group>
        </Panel>
      )}

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onDone={() => { setUploadOpen(false); invalidate() }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          open
          destructive
          title="알림음 삭제"
          description={`"${confirmDelete.name}"을(를) 삭제할까요? 이 소리를 고른 사용자는 첫 번째 소리로 돌아갑니다.`}
          confirmText="삭제"
          loading={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

/** 목록 한 줄 — 핸들로만 드래그해 드롭다운·버튼과 충돌하지 않는다 */
function SoundRow({ sound, label, index, playing, onPreview, onKind, onDelete, onDragDone }) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item as="div" value={sound} dragListener={false} dragControls={dragControls} onDragEnd={onDragDone}>
      <div
        className="flex items-center gap-3 px-4 py-2 border-b last:border-b-0"
        style={{
          borderColor: 'var(--mpl-card-line)',
          background: index % 2 === 1 ? 'var(--mpl-row)' : 'var(--mpl-card)',
        }}
      >
        <span
          onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
          title="드래그하여 순서 변경"
          className="w-[16px] shrink-0 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none', color: 'var(--text-dim)' }}
        >
          <GripIcon />
        </span>

        <span className="w-[58px] shrink-0 text-[13.5px] font-bold" style={{ color: 'var(--text-strong)' }}>
          {label}
        </span>

        <span className="w-[92px] shrink-0">
          <Select options={KIND_OPTIONS} value={sound.kind} onChange={onKind} />
        </span>

        <span
          className="flex-1 min-w-0 truncate text-[13px]"
          style={{ color: 'var(--text-dim)' }}
          title={sound.name}
        >
          {sound.name}
        </span>

        <span className="w-[62px] shrink-0 flex items-center justify-end gap-1">
          <IconBtn label={playing ? '정지' : '미리듣기'} onClick={onPreview}>
            {playing ? '■' : '▶'}
          </IconBtn>
          <IconBtn label="삭제" danger onClick={onDelete}>✕</IconBtn>
        </span>
      </div>
    </Reorder.Item>
  )
}

function IconBtn({ label, danger, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="w-7 h-7 rounded-lg grid place-items-center text-[12px] font-bold hover:brightness-[1.03]"
      style={{
        background: 'var(--mpl-card)',
        color: danger ? 'var(--mpl-red-to)' : 'var(--text-muted)',
        boxShadow: `inset 0 0 0 1px ${danger ? '#f0c2bd' : 'var(--mpl-card-line)'}`,
      }}
    >
      {children}
    </button>
  )
}

/** 파일 하나를 올린다 — 종류만 정하면 된다 (이름은 파일명 그대로) */
function UploadDialog({ onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [kind, setKind] = useState('alarm')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!file) { setError('파일을 골라 주세요'); return }
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      const res = await fetch('/api/admin/timer/sounds', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || '업로드 실패')
      onDone()
    } catch (e) {
      setError(e.message || '업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" style={{ background: 'var(--dialog-backdrop)' }}>
      <div
        className="w-full max-w-[380px] rounded-xl overflow-hidden"
        style={{ background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }}
      >
        <div
          className="px-4 py-3 text-[15px] font-bold"
          style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))', color: '#fff' }}
        >
          알림음 추가
        </div>
        <div className="p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
              파일 (mp3 · ogg · wav · m4a)
            </span>
            <input
              type="file"
              accept=".mp3,.ogg,.wav,.m4a,audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-[13px]"
              style={{ color: 'var(--text-muted)' }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>종류</span>
            <Select options={KIND_OPTIONS} value={kind} onChange={setKind} />
          </label>

          {error && <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
            <Button onClick={submit} disabled={busy}>{busy ? '올리는 중…' : '올리기'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
