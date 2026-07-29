import { memo } from 'react'

function ImageCard({ image, selected, selectMode, onToggle, onCopyUrl, copied }) {
  return (
    <div
      onClick={() => selectMode && onToggle(image.id)}
      className={`group relative rounded-xl border overflow-hidden ${selectMode ? 'cursor-pointer' : ''}`}
      style={{
        borderColor: selected ? 'var(--mpl-sky-to)' : 'var(--mpl-card-line)',
        background: 'var(--mpl-card)',
        boxShadow: selected ? '0 0 0 2px rgba(58,174,224,.25)' : '0 1px 3px rgba(31,44,61,.08)',
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
        className="aspect-square flex items-center justify-center p-3 relative"
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
        className="px-2.5 py-2 border-t"
        style={{ borderColor: 'var(--mpl-card-line)' }}
      >
        <div className="text-[13px] font-bold truncate text-center" style={{ color: 'var(--text-strong)' }}>{image.name}</div>
      </div>
    </div>
  )
}

export default memo(ImageCard)
