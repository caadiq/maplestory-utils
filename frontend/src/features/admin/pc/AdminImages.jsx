import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import ImageCard from './components/ImageCard'
import Pagination from './components/Pagination'
import UploadModal from './components/UploadModal'
import { PageHeader, Button, EmptyBox } from './components/ui'

/**
 * 한 페이지에 보여줄 개수.
 * 열 수(4·7)로 모두 나누어떨어져야 마지막 줄이 비지 않는다 — 28은 둘 다 만족한다.
 * 바꿀 때는 열 수도 같이 봐야 한다 (7열에 24개면 마지막 줄에 4칸이 빈다).
 */
const PAGE_SIZE = 28

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
  const [renaming, setRenaming] = useState(null)   // 이름 수정 다이얼로그 대상

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // 페이지·검색이 바뀌면 선택 초기화 — 화면에 없는 항목이 선택된 채 남으면
  // "N개 선택" 표시와 전체선택 토글이 실제 목록과 어긋난다
  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, debouncedSearch])

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

  /*
   * 페이지가 범위를 벗어나면 마지막 페이지로 되돌린다.
   * 마지막 페이지의 항목을 전부 선택 삭제하면 총 페이지 수가 줄어드는데,
   * page가 그대로면 서버가 빈 배열을 줘서 "이미지가 없습니다"만 뜨고
   * (페이지네이션은 그 분기에서 렌더되지 않아) 돌아갈 길이 없었다.
   */
  useEffect(() => {
    if (imagesData && page > totalPages) setPage(totalPages)
  }, [imagesData, page, totalPages])

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
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        credentials: 'include',
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

  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => api(`/api/admin/images/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: invalidateImages,
  })

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

  const copyTimer = useRef(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  const copyUrl = (image) => {
    navigator.clipboard.writeText(image.url)
    setCopiedId(image.id)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div>
      <PageHeader title="이미지 관리" description="공용 이미지를 업로드하고 관리합니다">
        {selectMode ? (
          <>
            <span className="text-[13px] mr-1" style={{ color: 'var(--text-muted)' }}>{selectedIds.size}개 선택</span>
            <Button variant="ghost" onClick={selectAll}>
              {selectedIds.size === images.length && images.length > 0 ? '전체 해제' : '전체 선택'}
            </Button>
            <Button variant="danger" onClick={requestDelete} disabled={selectedIds.size === 0}>삭제</Button>
            <Button variant="ghost" onClick={toggleSelectMode}>완료</Button>
          </>
        ) : (
          <>
            {images.length > 0 && <Button variant="dangerGhost" onClick={toggleSelectMode}>삭제</Button>}
            <Button onClick={() => setUploadOpen(true)}>+ 이미지 업로드</Button>
          </>
        )}
      </PageHeader>

      {/*
        검색창은 결과가 없어도 남겨둔다.
        images.length로만 조건을 걸었더니 한 글자만 쳐도 결과가 0이 되는 순간 입력칸이
        통째로 사라져(포커스까지 잃어) 검색을 이어갈 수 없었다.
      */}
      {(images.length > 0 || search || debouncedSearch) && (
        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이미지 이름으로 검색..."
            className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-[14px] outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
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
        <div className="grid gap-2.5 grid-cols-4 sm:grid-cols-7">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl animate-pulse"
              style={{ background: 'var(--skeleton-bg)' }}
            />
          ))}
        </div>
      ) : images.length === 0 ? (
        <EmptyBox
          icon="🖼️"
          text={debouncedSearch ? '검색 결과가 없습니다' : '업로드된 이미지가 없습니다'}
          action={!debouncedSearch ? <Button onClick={() => setUploadOpen(true)}>첫 이미지 업로드하기</Button> : null}
        />
      ) : (
        <>
          <div className="grid gap-2.5 grid-cols-4 sm:grid-cols-7">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onOpen={setRenaming}
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

      {renaming && (
        <RenameDialog
          image={renaming}
          takenNames={new Set([...allNames].filter((n) => n !== renaming.name))}
          saving={renameMutation.isPending}
          onSave={async (name) => {
            await renameMutation.mutateAsync({ id: renaming.id, name })
            setRenaming(null)
          }}
          onClose={() => setRenaming(null)}
        />
      )}

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

/**
 * 이름 수정 다이얼로그.
 * 이름은 다른 기능이 아이콘을 찾는 열쇠라(예: '지역 : 리멘') 오타를 고칠 방법이 필요하고,
 * 겹치면 엉뚱한 그림이 붙으므로 저장 전에 중복을 걸러 준다 (서버도 409로 막는다).
 */
function RenameDialog({ image, takenNames, saving, onSave, onClose }) {
  const [name, setName] = useState(image.name)
  const [error, setError] = useState('')
  const trimmed = name.trim()
  const dup = trimmed && trimmed !== image.name && takenNames.has(trimmed)

  const submit = async () => {
    if (!trimmed) { setError('이름을 입력해주세요'); return }
    if (dup) { setError('이미 있는 이름입니다'); return }
    if (trimmed === image.name) { onClose(); return }
    try {
      await onSave(trimmed)
    } catch (e) {
      setError(e.message || '수정 실패')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" style={{ background: 'var(--dialog-backdrop)' }} onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-xl overflow-hidden"
        style={{ background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 text-[15px] font-bold"
          style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))', color: '#fff' }}
        >
          이미지 이름 수정
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-16 h-16 shrink-0 rounded-lg grid place-items-center overflow-hidden"
              style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
            >
              <img src={image.url} alt="" className="w-full h-full object-contain p-1.5" style={{ imageRendering: 'pixelated' }} />
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
              disabled={saving}
              className="flex-1 min-w-0 rounded-lg border px-3 py-2.5 text-[14px] outline-none focus:border-[var(--input-border-focus)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: (error || dup) ? 'var(--mpl-red-to)' : 'var(--input-border)',
                color: 'var(--text-strong)',
              }}
            />
          </div>

          {(error || dup) && (
            <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{error || '이미 있는 이름입니다'}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
            <Button onClick={submit} disabled={saving || !trimmed || dup}>{saving ? '저장 중…' : '저장'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
