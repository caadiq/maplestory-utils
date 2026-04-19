import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { useAuthStore } from '../../../stores/auth'

/* ── 공용 모달 ── */
function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'var(--dialog-backdrop)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col`}
        style={{
          backgroundImage: 'linear-gradient(to bottom, var(--dialog-bg-from), var(--dialog-bg-to))',
          borderColor: 'var(--dialog-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <h3 className="font-semibold" style={{ color: 'var(--text-strong)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="text-xl leading-none hover:bg-[var(--row-hover-bg)] w-7 h-7 rounded flex items-center justify-center"
            style={{ color: 'var(--text-dim)' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── 업로드 모달 (다중 지원) ── */
function UploadModal({ open, onClose, onUpload, uploading, existingNames }) {
  const [items, setItems] = useState([])
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!open) setItems([])
  }, [open])

  const addFiles = (fileList) => {
    const newItems = []
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const id = `${Date.now()}-${Math.random()}`
      const reader = new FileReader()
      reader.onload = (e) => {
        setItems((prev) => prev.map((it) => it.id === id ? { ...it, preview: e.target.result } : it))
      }
      reader.readAsDataURL(file)
      newItems.push({
        id,
        file,
        name: file.name.replace(/\.[^.]+$/, ''),
        preview: null,
      })
    })
    setItems((prev) => [...prev, ...newItems])
  }

  const updateName = (id, name) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, name } : it))
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const trimmedNames = items.map((it) => it.name.trim())
  const hasEmpty = trimmedNames.some((n) => !n)
  const hasDupExisting = trimmedNames.some((n) => existingNames.has(n))
  const hasDupInList = trimmedNames.some((n, i) => trimmedNames.indexOf(n) !== i)
  const canSubmit = items.length > 0 && !hasEmpty && !hasDupExisting && !hasDupInList

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    await onUpload(items)
  }

  return (
    <Modal open={open} onClose={onClose} title={`이미지 업로드${items.length > 0 ? ` (${items.length})` : ''}`} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* 파일 추가 영역 */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              addFiles(e.dataTransfer.files)
            }}
            className="relative rounded-xl border-2 border-dashed cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
            style={dragOver ? {
              borderColor: 'var(--selected-border)',
              background: 'var(--selected-bg)',
            } : {
              borderColor: 'var(--dashed-border)',
              background: 'var(--skeleton-bg)',
            }}
          >
            <div className="text-2xl mb-1 opacity-50">📥</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>클릭하거나 이미지를 끌어다 놓으세요</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>여러 개 선택 가능</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
              className="hidden"
            />
          </label>

          {/* 선택된 파일 리스트 */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const trimmed = item.name.trim()
                const dupExisting = trimmed && existingNames.has(trimmed)
                const dupInList = trimmed && items.some((it, j) => j !== idx && it.name.trim() === trimmed)
                const empty = !trimmed
                const errorMsg = empty ? '이름을 입력해주세요'
                  : dupExisting ? '이미 존재하는 이름입니다'
                  : dupInList ? '같은 이름이 중복됩니다'
                  : null

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border p-2"
                    style={{
                      background: 'var(--surface-3)',
                      borderColor: errorMsg ? 'var(--icon-danger-border)' : 'var(--panel-border)',
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded flex items-center justify-center overflow-hidden shrink-0"
                      style={{ background: 'var(--surface-nested)' }}
                    >
                      {item.preview ? (
                        <img src={item.preview} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateName(item.id, e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-sm outline-none"
                        style={{
                          background: 'var(--input-bg)',
                          borderColor: errorMsg ? 'var(--icon-danger-border)' : 'var(--input-border)',
                          color: 'var(--text-strong)',
                        }}
                      />
                      {errorMsg && (
                        <div className="text-[11px] px-0.5" style={{ color: 'var(--danger-text)' }}>{errorMsg}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded shrink-0 hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)]"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div
          className="flex gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-[var(--btn-bg-hover)]"
            style={{
              background: 'var(--btn-bg)',
              borderColor: 'var(--btn-border)',
              color: 'var(--text-emphasis)',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit || uploading}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {uploading ? '업로드 중...' : `${items.length > 0 ? `${items.length}개 ` : ''}업로드`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── 이미지 카드 ── */
function ImageCard({ image, selected, selectMode, onToggle, onCopyUrl, copied }) {
  return (
    <div
      onClick={() => selectMode && onToggle(image.id)}
      className={`group relative rounded-xl border overflow-hidden ${selectMode ? 'cursor-pointer' : ''}`}
      style={{
        borderColor: selected ? 'var(--selected-border)' : 'var(--panel-border)',
        background: selected ? 'var(--selected-bg)' : 'var(--panel-bg)',
        boxShadow: selected ? '0 0 0 2px var(--ring-info)' : 'var(--panel-shadow)',
      }}
    >
      {selectMode && (
        <div
          className="absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center"
          style={selected ? {
            borderColor: 'var(--accent)',
            background: 'var(--accent)',
          } : {
            borderColor: 'var(--panel-border)',
            background: 'var(--surface-3)',
          }}
        >
          {selected && <span className="text-xs" style={{ color: 'var(--btn-primary-text)' }}>✓</span>}
        </div>
      )}

      <div
        className="aspect-square flex items-center justify-center p-4 relative"
        style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
      >
        <img
          src={image.url}
          alt={image.name}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />

        {!selectMode && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={(e) => { e.stopPropagation(); onCopyUrl(image) }}
              className="w-7 h-7 rounded-md backdrop-blur-sm border text-xs flex items-center justify-center hover:bg-[var(--selected-bg)] hover:border-[var(--selected-border)]"
              style={{
                background: 'var(--btn-bg)',
                borderColor: 'var(--btn-border)',
                color: 'var(--text-emphasis)',
              }}
              title="URL 복사"
            >
              {copied ? '✓' : '⧉'}
            </button>
          </div>
        )}
      </div>

      <div
        className="px-3 py-2 border-t"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <div className="text-sm font-medium truncate">{image.name}</div>
      </div>
    </div>
  )
}

/* ── 페이지네이션 ── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const maxButtons = 7
  let start = Math.max(1, page - Math.floor(maxButtons / 2))
  let end = Math.min(totalPages, start + maxButtons - 1)
  if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  const baseBtn = "min-w-9 h-9 px-3 rounded-lg text-sm flex items-center justify-center border hover:bg-[var(--btn-bg-hover)]"
  const btnStyle = {
    background: 'var(--btn-bg)',
    borderColor: 'var(--btn-border)',
    color: 'var(--text-emphasis)',
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={`${baseBtn} disabled:opacity-30 disabled:cursor-not-allowed`}
        style={btnStyle}
      >
        ‹
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onChange(1)} className={baseBtn} style={btnStyle}>1</button>
          {start > 2 && <span className="px-1" style={{ color: 'var(--text-dim)' }}>…</span>}
        </>
      )}

      {pages.map((p) => {
        const active = p === page
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${baseBtn} ${active ? 'font-medium' : ''}`}
            style={active ? {
              background: 'var(--selected-bg)',
              borderColor: 'var(--selected-border)',
              color: 'var(--accent-bright)',
            } : btnStyle}
          >
            {p}
          </button>
        )
      })}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1" style={{ color: 'var(--text-dim)' }}>…</span>}
          <button onClick={() => onChange(totalPages)} className={baseBtn} style={btnStyle}>{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`${baseBtn} disabled:opacity-30 disabled:cursor-not-allowed`}
        style={btnStyle}
      >
        ›
      </button>
    </div>
  )
}

const PAGE_SIZE = 24

/* ── 메인 ── */
export default function AdminImages() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: imagesData, isLoading } = useQuery({
    queryKey: ['admin', 'images', { page, search: debouncedSearch }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page,
        limit: PAGE_SIZE,
        ...(debouncedSearch && { search: debouncedSearch }),
      })
      return api(`/api/admin/images?${params}`)
    },
    placeholderData: (prev) => prev,
  })

  const images = imagesData?.items || []
  const totalPages = imagesData?.total_pages || 1

  const { data: allNamesArray = [] } = useQuery({
    queryKey: ['admin', 'images', 'names'],
    queryFn: () => api('/api/admin/images/names'),
  })
  const allNames = new Set(allNamesArray)

  const invalidateImages = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'images'] })
  }

  const uploadMutation = useMutation({
    mutationFn: async (items) => {
      const formData = new FormData()
      items.forEach((it) => {
        formData.append('files', it.file)
        formData.append('names', it.name.trim())
      })
      const adminKey = useAuthStore.getState().apiKey
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: formData,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '업로드 실패')
      return result
    },
    onSuccess: (result) => {
      if (result.errors?.length > 0) {
        alert(`일부 업로드 실패:\n${result.errors.map((e) => `- ${e.name}: ${e.error}`).join('\n')}`)
      }
      setUploadOpen(false)
      invalidateImages()
    },
    onError: (err) => alert(err.message),
  })

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev)
    setSelectedIds(new Set())
  }

  const selectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)))
    }
  }

  const requestDelete = () => {
    const items = images.filter((img) => selectedIds.has(img.id))
    setConfirmDelete({
      ids: items.map((i) => i.id),
      names: items.map((i) => i.name),
    })
  }

  const deleteMutation = useMutation({
    mutationFn: (ids) => api('/api/admin/images/delete', { method: 'POST', body: { ids } }),
    onSuccess: () => {
      setConfirmDelete(null)
      setSelectedIds(new Set())
      setSelectMode(false)
      invalidateImages()
    },
    onError: (err) => alert(err.message),
  })

  const copyUrl = (image) => {
    navigator.clipboard.writeText(image.url)
    setCopiedId(image.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">이미지 관리</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>공용 이미지를 업로드하고 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{selectedIds.size}개 선택</span>
              <button
                onClick={selectAll}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--btn-bg-hover)]"
                style={{
                  background: 'var(--btn-bg)',
                  borderColor: 'var(--btn-border)',
                  color: 'var(--text-emphasis)',
                }}
              >
                {selectedIds.size === images.length && images.length > 0 ? '전체 해제' : '전체 선택'}
              </button>
              <button
                onClick={requestDelete}
                disabled={selectedIds.size === 0}
                className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--btn-danger-bg-hover)]"
                style={{
                  background: 'var(--btn-danger-bg)',
                  color: 'var(--btn-primary-text)',
                  boxShadow: 'var(--btn-danger-shadow)',
                }}
              >
                삭제
              </button>
              <button
                onClick={toggleSelectMode}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--btn-bg-hover)]"
                style={{
                  background: 'var(--btn-bg)',
                  borderColor: 'var(--btn-border)',
                  color: 'var(--text-emphasis)',
                }}
              >
                완료
              </button>
            </>
          ) : (
            <>
              {images.length > 0 && (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--danger-bg-hover)]"
                  style={{
                    borderColor: 'var(--icon-danger-border)',
                    color: 'var(--danger-text)',
                  }}
                >
                  삭제
                </button>
              )}
              <button
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--btn-primary-bg-hover)]"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  boxShadow: 'var(--btn-primary-shadow)',
                }}
              >
                <span className="text-base leading-none">+</span>
                이미지 업로드
              </button>
            </>
          )}
        </div>
      </div>

      {/* 검색 */}
      {images.length > 0 && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이미지 이름으로 검색..."
            className="w-full rounded-lg border pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
              color: 'var(--text-strong)',
            }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--input-icon)' }}>🔍</span>
        </div>
      )}

      {/* 이미지 그리드 */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl animate-pulse"
              style={{ background: 'var(--skeleton-bg)' }}
            />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-16 text-center"
          style={{
            borderColor: 'var(--dashed-border)',
            background: 'var(--skeleton-bg)',
          }}
        >
          <div className="text-5xl mb-3 opacity-30">🖼️</div>
          <p className="mb-4" style={{ color: 'var(--text-muted)' }}>
            {debouncedSearch ? '검색 결과가 없습니다' : '업로드된 이미지가 없습니다'}
          </p>
          {!debouncedSearch && (
            <button
              onClick={() => setUploadOpen(true)}
              className="text-sm hover:text-[var(--accent-hover-text)]"
              style={{ color: 'var(--accent)' }}
            >
              첫 이미지 업로드하기 →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                selected={selectedIds.has(image.id)}
                selectMode={selectMode}
                onToggle={toggleSelect}
                onCopyUrl={copyUrl}
                copied={copiedId === image.id}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={(items) => uploadMutation.mutate(items)}
        uploading={uploadMutation.isPending}
        existingNames={allNames}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => deleteMutation.mutate(confirmDelete.ids)}
        title="이미지 삭제"
        description={confirmDelete ? `${confirmDelete.ids.length}개의 이미지를 삭제하시겠습니까?\n\n${confirmDelete.names.slice(0, 5).map((n) => `· ${n}`).join('\n')}${confirmDelete.names.length > 5 ? `\n· 외 ${confirmDelete.names.length - 5}개` : ''}\n\n이 작업은 되돌릴 수 없습니다.` : ''}
        confirmText="삭제"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
