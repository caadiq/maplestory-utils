/**
 * 관리자 페이지에서 쓰는 일반 모달 래퍼
 * <Modal open={open} onClose={onClose} title="제목" maxWidth="max-w-md">
 *   <div>content</div>
 * </Modal>
 */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
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
