import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Reorder, useDragControls } from 'framer-motion'
import { api } from '../../../api/client'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import Modal from '../../../components/common/Modal'
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
          onDone={(opt) => { if (!opt?.keepOpen) setUploadOpen(false); invalidate() }}
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

/** 서버가 받아주는 형식 — 여기서 미리 걸러야 올리고 나서 실패하는 일이 없다 */
const AUDIO_EXT = ['mp3', 'ogg', 'wav', 'm4a']
const extOf = (name) => (name.split('.').pop() || '').toLowerCase()

/**
 * 한 번에 여러 개를 올린다 — 종류만 정하면 된다 (이름은 파일명 그대로).
 *
 * 고른 것을 목록으로 펼쳐 보여주고 하나씩 뺄 수 있게 한 건, 파일 선택창의
 * "파일 3개"만으로는 뭘 골랐는지 알 수 없어서다. 이미지 업로드(UploadModal)와 같은 모양.
 */
function UploadDialog({ onClose, onDone }) {
  const [items, setItems] = useState([])
  const [kind, setKind] = useState('alarm')
  const [dragOver, setDragOver] = useState(false)
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState(null)
  const [failed, setFailed] = useState([])
  const [busy, setBusy] = useState(false)

  const addFiles = (fileList) => {
    const picked = Array.from(fileList)
    const ok = picked.filter((f) => AUDIO_EXT.includes(extOf(f.name)))
    setSkipped(picked.length - ok.length)
    setError(null)
    setFailed([])
    setItems((prev) => {
      // 끌어다 놓기로 쌓다 보면 같은 파일을 두 번 넣기 쉽다 — 이름·크기가 같으면 한 번만
      const seen = new Set(prev.map((it) => `${it.file.name}:${it.file.size}`))
      const add = []
      for (const file of ok) {
        const sig = `${file.name}:${file.size}`
        if (seen.has(sig)) continue
        seen.add(sig)
        add.push({ id: sig + Math.random(), file })
      }
      return [...prev, ...add]
    })
  }

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id))

  const submit = async () => {
    if (!items.length) { setError('파일을 골라 주세요'); return }
    setBusy(true)
    setError(null)
    setFailed([])
    try {
      const form = new FormData()
      for (const it of items) form.append('files', it.file)
      form.append('kind', kind)
      const res = await fetch('/api/admin/timer/sounds', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFailed(result.failed ?? [])
        throw new Error(result.error || '업로드 실패')
      }
      /*
       * 일부만 실패했으면 창을 닫지 않고 뭐가 안 됐는지 보여준다 —
       * 닫아 버리면 열 개 중 몇 개가 빠졌는지 목록에서 일일이 찾아야 한다.
       */
      if (result.failed?.length) {
        setFailed(result.failed)
        setItems([])
        onDone({ keepOpen: true })
        return
      }
      onDone()
    } catch (e) {
      setError(e.message || '업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`알림음 업로드${items.length > 0 ? ` (${items.length})` : ''}`}
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
            className="relative rounded-xl border-2 border-dashed cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
            style={dragOver
              ? { borderColor: 'var(--selected-border)', background: 'var(--selected-bg)' }
              : { borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)' }}
          >
            <div className="text-2xl mb-1 opacity-50">🎵</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>클릭하거나 음원을 끌어다 놓으세요</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>여러 개 선택 가능 · mp3 · ogg · wav · m4a</p>
            <input
              type="file"
              accept=".mp3,.ogg,.wav,.m4a,audio/*"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
              className="hidden"
            />
          </label>

          {skipped > 0 && (
            <p className="text-xs" style={{ color: 'var(--danger-text)' }}>
              {skipped}개는 지원하지 않는 형식이라 제외했습니다
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>종류</span>
            <Select options={KIND_OPTIONS} value={kind} onChange={setKind} />
          </label>

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border p-2"
                  style={{ background: 'var(--surface-3)', borderColor: 'var(--panel-border)' }}
                >
                  <div
                    className="w-12 h-12 rounded grid place-items-center shrink-0 text-lg"
                    style={{ background: 'var(--surface-nested)' }}
                  >
                    🎵
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-strong)' }}>{item.file.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                      {(item.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="제외"
                    onClick={() => removeItem(item.id)}
                    className="w-7 h-7 rounded shrink-0 hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)]"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{error}</p>}

          {failed.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-bold" style={{ color: 'var(--danger-text)' }}>
                {failed.length}개를 못 올렸습니다
              </p>
              {failed.map((f) => (
                <p key={f.name} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {f.name} — {f.error}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-[var(--btn-bg-hover)] disabled:opacity-50"
            style={{ background: 'var(--btn-bg)', borderColor: 'var(--btn-border)', color: 'var(--text-emphasis)' }}
          >
            {failed.length ? '닫기' : '취소'}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !items.length}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {busy ? '업로드 중...' : `${items.length > 0 ? `${items.length}개 ` : ''}업로드`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
