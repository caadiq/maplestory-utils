import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { api } from '../../../../api/client'
import { useBackClose } from '../../../../hooks/useBackClose'

const PAGE_SIZE = 24

export default function ImagePicker({ open, onClose, onSelect, currentImageId }) {
  useBackClose(open, onClose)

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

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ background: 'var(--dialog-backdrop)' }}
      >
        <motion.div
          key="dialog"
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-3xl rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col"
          style={{
            backgroundImage: 'linear-gradient(to bottom, var(--dialog-bg-from), var(--dialog-bg-to))',
            borderColor: 'var(--dialog-border)',
          }}
        >
        <div
          className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <h3 className="font-semibold" style={{ color: 'var(--text-strong)' }}>이미지 선택</h3>
          <button
            onClick={onClose}
            className="text-xl leading-none hover:bg-[var(--row-hover-bg)] w-7 h-7 rounded flex items-center justify-center"
            style={{ color: 'var(--text-dim)' }}
          >
            ×
          </button>
        </div>

        {/* 검색 */}
        <div className="px-6 pt-4 shrink-0">
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
        </div>

        {/* 이미지 그리드 — 6×4 (24개) 높이로 고정, 내부는 OverlayScrollbars */}
        <OverlayScrollbarsComponent
          className="shrink-0"
          style={{ height: '632px', overscrollBehavior: 'contain' }}
          options={{
            scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 },
            overflow: { x: 'hidden', y: 'scroll' },
          }}
          defer
        >
          <div className="px-6 pt-4 pb-6">
            {isLoading ? (
              <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg animate-pulse"
                    style={{ background: 'var(--skeleton-bg)' }}
                  />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                {debouncedSearch ? '검색 결과가 없습니다' : '업로드된 이미지가 없습니다'}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                {images.map((image) => {
                  const isSelected = currentImageId === image.id
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => { onSelect(image); onClose() }}
                      className="group rounded-lg border overflow-hidden"
                      style={{
                        borderColor: isSelected ? 'var(--selected-border)' : 'var(--panel-border)',
                        boxShadow: isSelected ? '0 0 0 2px var(--ring-info)' : undefined,
                      }}
                    >
                      <div
                        className="aspect-square flex items-center justify-center p-4"
                        style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
                      >
                        <img src={image.url} alt={image.name} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                      </div>
                      <div
                        className="px-2 py-1.5 border-t"
                        style={{
                          borderColor: 'var(--panel-border)',
                          background: 'var(--surface-3)',
                        }}
                      >
                        <div className="text-xs truncate">{image.name}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </OverlayScrollbarsComponent>

        {/* 페이지네이션 + 액션 (없으면 전체 섹션 숨김) */}
        {(totalPages > 1 || currentImageId) && (
          <div className="px-6 pb-6 pt-1 flex items-center justify-between shrink-0 gap-3">
            {totalPages > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded border hover:bg-[var(--btn-bg-hover)] disabled:opacity-30 flex items-center justify-center text-sm"
                  style={{
                    background: 'var(--btn-bg)',
                    borderColor: 'var(--btn-border)',
                    color: 'var(--text-emphasis)',
                  }}
                >
                  ‹
                </button>
                <span className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded border hover:bg-[var(--btn-bg-hover)] disabled:opacity-30 flex items-center justify-center text-sm"
                  style={{
                    background: 'var(--btn-bg)',
                    borderColor: 'var(--btn-border)',
                    color: 'var(--text-emphasis)',
                  }}
                >
                  ›
                </button>
              </div>
            ) : <div />}

            {currentImageId && (
              <button
                type="button"
                onClick={() => { onSelect(null); onClose() }}
                className="text-sm hover:text-[var(--danger-text-strong)]"
                style={{ color: 'var(--danger-text)' }}
              >
                이미지 제거
              </button>
            )}
          </div>
        )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
