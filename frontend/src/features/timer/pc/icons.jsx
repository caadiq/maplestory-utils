/** HUD 조작 아이콘 — 본 화면과 미니 HUD가 같이 쓴다 */

/**
 * 타이머 초기화 — 스톱워치.
 * 원형 화살표(↻)는 "새로고침"으로 읽혀서 이 버튼이 타이머를 되돌리는 것인 줄 모르는 경우가 있었다.
 */
export function TimerResetIcon({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="11" r="6.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 7.6V11l2.4 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.6 2.6h4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.4 5.4l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function PipIcon({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1.8" y="3.4" width="16.4" height="13.2" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="9.6" y="9.4" width="7" height="5.4" rx="1.2" fill="currentColor" />
    </svg>
  )
}

/**
 * 아이콘 다시 찾기 — 조준선.
 * 자르기 기호(⌐L)는 "이미지 crop"으로 읽혀 화면에서 아이콘을 찾는 동작과 연결되지 않았다.
 */
export function TargetIcon({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="5.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="10" cy="10" r="1.7" fill="currentColor" />
      <path d="M10 1.4v3.2M10 15.4v3.2M1.4 10h3.2M15.4 10h3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 화면 공유 중단 — 모니터에 X. 원+X는 일반적인 "닫기"와 구분되지 않았다. */
export function ScreenOffIcon({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1.8" y="3.2" width="16.4" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 17.2h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.4 6.4l5.2 5.2M12.6 6.4l-5.2 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
