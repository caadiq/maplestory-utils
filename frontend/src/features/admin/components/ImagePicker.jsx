import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

const PAGE_SIZE = 24

/**
 * 업로드된 이미지 중 하나를 선택하는 모달 피커
 */
export default function ImagePicker({ open, onClose, onSelect, currentImageId }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setDebouncedSearch('')
      setPage(1)
    }
  }, [open])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'images', { page, search: debouncedSearch }],
    queryFn: () => {
      const params = new URLSearchParams({
        page,
        limit: PAGE_SIZE,
        ...(debouncedSearch && { search: debouncedSearch }),
      })
      return api(`/api/admin/images?${params}`)
    },
    enabled: open,
    placeholderData: (prev) => prev,
  })

  const images = data?.items || []
  const totalPages = data?.total_pages || 1

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <h3 className="font-semibold">이미지 선택</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-xl leading-none">×</button>
        </div>

        {/* 검색 */}
        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이미지 이름으로 검색..."
              className="w-full rounded-lg border border-white/10 bg-gray-950 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-emerald-500/50 transition"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          </div>
        </div>

        {/* 이미지 그리드 */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              {debouncedSearch ? '검색 결과가 없습니다' : '업로드된 이미지가 없습니다'}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => { onSelect(image); onClose() }}
                  className={`group rounded-lg border overflow-hidden transition ${
                    currentImageId === image.id
                      ? 'border-emerald-500/60 ring-2 ring-emerald-500/30'
                      : 'border-white/5 hover:border-white/20'
                  }`}
                  title={image.name}
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center p-3">
                    <img src={image.url} alt={image.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="px-2 py-1.5 border-t border-white/5 bg-gray-950/50">
                    <div className="text-xs truncate">{image.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 페이지네이션 + 액션 */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between shrink-0 gap-3">
          {totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm"
              >
                ‹
              </button>
              <span className="text-xs text-gray-400 px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm"
              >
                ›
              </button>
            </div>
          ) : <div />}

          {currentImageId && (
            <button
              type="button"
              onClick={() => { onSelect(null); onClose() }}
              className="text-sm text-red-400 hover:text-red-300 transition"
            >
              이미지 제거
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
