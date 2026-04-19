import { useState, useEffect } from 'react'
import Modal from '../../../../components/common/Modal'

export default function UploadModal({ open, onClose, onUpload, uploading, existingNames }) {
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
