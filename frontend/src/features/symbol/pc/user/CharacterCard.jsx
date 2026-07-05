import { memo } from 'react'

function CharacterCard({ char, active, onSelect, onRemove }) {
  return (
    <div
      onClick={(e) => {
        if (e.target.closest('button')) return
        onSelect()
      }}
      className="group relative shrink-0 w-36 rounded-xl border cursor-pointer select-none"
      style={{
        borderColor: active ? 'var(--selected-border)' : 'var(--panel-border)',
        background: active ? 'var(--selected-bg)' : 'var(--surface-3)',
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, color: 'var(--text-dim)' }}
        className="w-6 h-6 rounded-md hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)] flex items-center justify-center text-base leading-none"
        aria-label="삭제"
      >
        ×
      </button>

      <div className="pt-3 px-3 pb-3 flex flex-col items-center text-center">
        <div className="w-24 h-24 overflow-hidden flex items-center justify-center">
          {char.character_image ? (
            <img
              src={char.character_image}
              alt=""
              className="w-full h-full object-contain scale-[3] origin-center pointer-events-none"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
            />
          ) : (
            <span className="text-3xl" style={{ color: 'var(--text-dim)' }}>?</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 w-full min-w-0">
          {char.world_icon && (
            <img
              src={char.world_icon}
              alt=""
              title={char.world_name}
              className="w-5 h-5 shrink-0 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          )}
          <span
            className="text-base font-semibold truncate"
            style={{ color: active ? 'var(--accent-bright)' : 'var(--text-emphasis)' }}
          >
            {char.character_name}
          </span>
        </div>
        <div
          className="text-xs tabular-nums mt-0.5 truncate w-full"
          style={{ color: 'var(--text-dim)' }}
        >
          Lv.{char.character_level} · {char.job_name}
        </div>
      </div>
    </div>
  )
}

export default memo(CharacterCard)
