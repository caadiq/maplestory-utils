export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  destructive = false,
  loading = false,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-xl leading-none">×</button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{description}</p>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 transition"
          >
            {cancelText}
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
      </div>
    </div>
  )
}
