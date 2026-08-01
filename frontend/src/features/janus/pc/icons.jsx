/** HUD 조작 아이콘 — 본 화면과 미니 HUD가 같이 쓴다 */

export function RefreshIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M13.4 1.9v3.1h-3.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PipIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.4" y="2.6" width="13.2" height="10.8" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7.8" y="7.6" width="5.6" height="4.6" rx="1" fill="currentColor" />
    </svg>
  )
}

export function CropIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.6 1.4v10h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.4 4.6h10v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StopIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

const TONES = {
  slate: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  sky: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
  red: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))',
  tan: 'linear-gradient(180deg, var(--mpl-tan-from), var(--mpl-tan-to))',
}

/** 아이콘만 있는 정사각 버튼 */
export function IconButton({ tone, label, onClick, size = 40, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-[10px] grid place-items-center text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: TONES[tone],
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 2px 5px rgba(0,0,0,.25)',
      }}
    >
      {children}
    </button>
  )
}
