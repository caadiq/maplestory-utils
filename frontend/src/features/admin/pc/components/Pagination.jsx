export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const maxButtons = 7
  let start = Math.max(1, page - Math.floor(maxButtons / 2))
  let end = Math.min(totalPages, start + maxButtons - 1)
  if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  const baseBtn = "min-w-9 h-9 px-3 rounded-lg text-sm flex items-center justify-center border hover:bg-[var(--btn-bg-hover)]"
  const btnStyle = {
    background: 'var(--btn-bg)',
    borderColor: 'var(--btn-border)',
    color: 'var(--text-emphasis)',
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={`${baseBtn} disabled:opacity-30`}
        style={btnStyle}
      >
        ‹
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onChange(1)} className={baseBtn} style={btnStyle}>1</button>
          {start > 2 && <span className="px-1" style={{ color: 'var(--text-dim)' }}>…</span>}
        </>
      )}

      {pages.map((p) => {
        const active = p === page
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${baseBtn} ${active ? 'font-medium' : ''}`}
            style={active ? {
              background: 'var(--selected-bg)',
              borderColor: 'var(--selected-border)',
              color: 'var(--accent-bright)',
            } : btnStyle}
          >
            {p}
          </button>
        )
      })}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1" style={{ color: 'var(--text-dim)' }}>…</span>}
          <button onClick={() => onChange(totalPages)} className={baseBtn} style={btnStyle}>{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`${baseBtn} disabled:opacity-30`}
        style={btnStyle}
      >
        ›
      </button>
    </div>
  )
}
