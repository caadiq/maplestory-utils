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

export function GearIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 1.3v1.6M8 13.1v1.6M14.7 8h-1.6M2.9 8H1.3M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      />
    </svg>
  )
}

export function BellIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 6.6a4 4 0 1 1 8 0c0 2.5.7 3.6 1.2 4.2.3.3.1.8-.4.8H3.2c-.5 0-.7-.5-.4-.8.5-.6 1.2-1.7 1.2-4.2Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M6.5 13.4a1.7 1.7 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
