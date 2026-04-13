import { useState, useEffect, useRef } from 'react'
import { api } from '../../api/client'

function UploadModal({ open, onClose, onUpload, uploading }) {
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setName('')
      setPreview(null)
    }
  }, [open])

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    setName(f.name.replace(/\.[^.]+$/, ''))
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !name.trim()) return
    await onUpload({ file, name: name.trim() })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold">이미지 업로드</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 파일 업로드 영역 */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files[0])
            }}
            className={`relative rounded-xl border-2 border-dashed transition cursor-pointer min-h-[180px] flex flex-col items-center justify-center overflow-hidden ${
              dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
            }`}
          >
            {preview ? (
              <img src={preview} alt="" className="max-h-40 object-contain p-3" />
            ) : (
              <>
                <div className="text-3xl mb-2 opacity-50">🖼️</div>
                <p className="text-sm text-gray-400">클릭하거나 이미지를 끌어다 놓으세요</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG, WEBP 등</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
          </label>

          {/* 이름 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">이미지 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 강렬한 힘의 결정"
              className="w-full rounded-lg border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50 transition"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 transition">
              취소
            </button>
            <button
              type="submit"
              disabled={!file || !name.trim() || uploading}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ImageCard({ image, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyUrl = () => {
    navigator.clipboard.writeText(image.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group relative rounded-xl border border-white/5 bg-gray-900/40 overflow-hidden hover:border-white/15 transition">
      {/* 이미지 영역 */}
      <div className="aspect-square bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center p-4 relative">
        <img src={image.url} alt={image.name} className="max-w-full max-h-full object-contain" />

        {/* 액션 버튼 */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={copyUrl}
            className="w-7 h-7 rounded-md bg-gray-950/80 backdrop-blur-sm border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-xs flex items-center justify-center transition"
            title="URL 복사"
          >
            {copied ? '✓' : '⧉'}
          </button>
          <button
            onClick={() => onDelete(image)}
            className="w-7 h-7 rounded-md bg-gray-950/80 backdrop-blur-sm border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 text-xs flex items-center justify-center transition"
            title="삭제"
          >
            ×
          </button>
        </div>
      </div>

      {/* 정보 */}
      <div className="px-3 py-2 border-t border-white/5">
        <div className="text-sm font-medium truncate">{image.name}</div>
        <div className="text-xs text-gray-500 truncate mt-0.5">{image.url}</div>
      </div>
    </div>
  )
}

export default function AdminImages() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')

  const fetchImages = async () => {
    setLoading(true)
    try {
      const data = await api('/api/admin/images')
      setImages(data)
    } catch {
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [])

  const handleUpload = async ({ file, name }) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)

      const adminKey = localStorage.getItem('maple-admin-key')
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '업로드 실패')
      }
      setModalOpen(false)
      await fetchImages()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (image) => {
    if (!confirm(`"${image.name}" 이미지를 삭제하시겠습니까?`)) return
    try {
      await api(`/api/admin/images/${image.id}`, { method: 'DELETE' })
      await fetchImages()
    } catch (err) {
      alert(err.message)
    }
  }

  const filtered = images.filter((img) =>
    img.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">이미지 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">공용 이미지를 업로드하고 관리합니다</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium transition shadow-lg shadow-emerald-500/20"
        >
          <span className="text-base leading-none">+</span>
          이미지 업로드
        </button>
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
      {loading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
          <div className="text-5xl mb-3 opacity-30">🖼️</div>
          <p className="text-gray-400 mb-4">
            {images.length === 0 ? '업로드된 이미지가 없습니다' : '검색 결과가 없습니다'}
          </p>
          {images.length === 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition"
            >
              첫 이미지 업로드하기 →
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((image) => (
            <ImageCard key={image.id} image={image} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <UploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpload={handleUpload}
        uploading={uploading}
      />
    </div>
  )
}
