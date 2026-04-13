import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

/* ── 공용 모달 ── */
function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${maxWidth} rounded-2xl bg-gray-900 border border-white/10 shadow-2xl max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── 업로드 모달 (다중 지원) ── */
function UploadModal({ open, onClose, onUpload, uploading, existingNames }) {
  const [items, setItems] = useState([]) // { file, name, preview, id }
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
            className={`relative rounded-xl border-2 border-dashed transition cursor-pointer min-h-[120px] flex flex-col items-center justify-center ${
              dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
            }`}
          >
            <div className="text-2xl mb-1 opacity-50">📥</div>
            <p className="text-sm text-gray-400">클릭하거나 이미지를 끌어다 놓으세요</p>
            <p className="text-xs text-gray-600 mt-0.5">여러 개 선택 가능</p>
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
                  <div key={item.id} className={`flex items-start gap-3 rounded-lg border bg-gray-950/50 p-2 ${
                    errorMsg ? 'border-red-500/40' : 'border-white/5'
                  }`}>
                    <div className="w-12 h-12 rounded bg-gray-900 flex items-center justify-center overflow-hidden shrink-0">
                      {item.preview ? (
                        <img src={item.preview} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateName(item.id, e.target.value)}
                        className={`w-full rounded border bg-gray-900 px-2 py-1.5 text-sm outline-none transition ${
                          errorMsg ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-emerald-500/50'
                        }`}
                      />
                      {errorMsg && <div className="text-[11px] text-red-400 px-0.5">{errorMsg}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
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
        <div className="flex gap-2 px-6 py-4 border-t border-white/5 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 transition">
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit || uploading}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {uploading ? '업로드 중...' : `${items.length > 0 ? `${items.length}개 ` : ''}업로드`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── 삭제 확인 다이얼로그 ── */
function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmText = '삭제', destructive = false, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="p-6">
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{description}</p>
      </div>
      <div className="flex gap-2 px-6 py-4 border-t border-white/5">
        <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 transition">
          취소
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            destructive
              ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {loading ? '처리 중...' : confirmText}
        </button>
      </div>
    </Modal>
  )
}

/* ── 이미지 카드 ── */
function ImageCard({ image, selected, selectMode, onToggle, onCopyUrl, copied }) {
  return (
    <div
      onClick={() => selectMode && onToggle(image.id)}
      className={`group relative rounded-xl border overflow-hidden transition ${
        selected
          ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/30'
          : 'border-white/5 bg-gray-900/40 hover:border-white/15'
      } ${selectMode ? 'cursor-pointer' : ''}`}
    >
      {/* 체크박스 (선택모드) */}
      {selectMode && (
        <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
          selected ? 'border-emerald-500 bg-emerald-500' : 'border-white/30 bg-gray-950/80'
        }`}>
          {selected && <span className="text-xs text-white">✓</span>}
        </div>
      )}

      <div className="aspect-square bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center p-4 relative">
        <img src={image.url} alt={image.name} className="max-w-full max-h-full object-contain" />

        {!selectMode && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={(e) => { e.stopPropagation(); onCopyUrl(image) }}
              className="w-7 h-7 rounded-md bg-gray-950/80 backdrop-blur-sm border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-xs flex items-center justify-center transition"
              title="URL 복사"
            >
              {copied ? '✓' : '⧉'}
            </button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/5">
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

  const btn = "min-w-9 h-9 px-3 rounded-lg text-sm transition flex items-center justify-center"

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={`${btn} border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        ‹
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onChange(1)} className={`${btn} border border-white/10 hover:bg-white/5`}>1</button>
          {start > 2 && <span className="text-gray-600 px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`${btn} ${
            p === page
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-medium'
              : 'border border-white/10 hover:bg-white/5'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-gray-600 px-1">…</span>}
          <button onClick={() => onChange(totalPages)} className={`${btn} border border-white/10 hover:bg-white/5`}>{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`${btn} border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed`}
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
  const [confirmDelete, setConfirmDelete] = useState(null) // {ids, names}
  const [copiedId, setCopiedId] = useState(null)

  // 검색어 디바운싱
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // 이미지 목록 (페이징 + 검색)
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

  // 전체 이름 (중복 체크용)
  const { data: allNamesArray = [] } = useQuery({
    queryKey: ['admin', 'images', 'names'],
    queryFn: () => api('/api/admin/images/names'),
  })
  const allNames = new Set(allNamesArray)

  const invalidateImages = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'images'] })
  }

  // 업로드
  const uploadMutation = useMutation({
    mutationFn: async (items) => {
      const formData = new FormData()
      items.forEach((it) => {
        formData.append('files', it.file)
        formData.append('names', it.name.trim())
      })
      const adminKey = localStorage.getItem('maple-admin-key')
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

  // 삭제
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
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">이미지 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">공용 이미지를 업로드하고 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <span className="text-sm text-gray-400">{selectedIds.size}개 선택</span>
              <button
                onClick={selectAll}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 transition"
              >
                {selectedIds.size === images.length && images.length > 0 ? '전체 해제' : '전체 선택'}
              </button>
              <button
                onClick={requestDelete}
                disabled={selectedIds.size === 0}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-red-500/20"
              >
                삭제
              </button>
              <button
                onClick={toggleSelectMode}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 transition"
              >
                완료
              </button>
            </>
          ) : (
            <>
              {images.length > 0 && (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 px-3 py-2 text-sm transition"
                >
                  삭제
                </button>
              )}
              <button
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium transition shadow-lg shadow-emerald-500/20"
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
            className="w-full rounded-lg border border-white/10 bg-gray-900/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-emerald-500/50 transition"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        </div>
      )}

      {/* 이미지 그리드 */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
          <div className="text-5xl mb-3 opacity-30">🖼️</div>
          <p className="text-gray-400 mb-4">
            {debouncedSearch ? '검색 결과가 없습니다' : '업로드된 이미지가 없습니다'}
          </p>
          {!debouncedSearch && (
            <button
              onClick={() => setUploadOpen(true)}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition"
            >
              첫 이미지 업로드하기 →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
