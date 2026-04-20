import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { useAuthStore } from '../../../stores/auth'
import ImageCard from './components/ImageCard'
import Pagination from './components/Pagination'
import UploadModal from './components/UploadModal'

const PAGE_SIZE = 24

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
                className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-[var(--btn-danger-bg-hover)]"
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
