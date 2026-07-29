/**
 * 관리자 공용 UI 조각 — 사이드바 레이아웃 안에서 쓰는 헤더·패널·행·버튼.
 * 사용자 페이지의 게임창 톤(슬레이트 바 + 흰 패널)을 그대로 따른다.
 */

export const PANEL = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }

export const SLATE_BAR = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}

/** 페이지 상단 — 제목·설명 + 우측 액션 */
export function PageHeader({ title, description, children }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
      <div>
        <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-strong)' }}>{title}</h2>
        {description && (
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-1.5">{children}</div>}
    </div>
  )
}

/** 슬레이트 헤더가 붙은 패널 */
export function Panel({ title, right, children, className = '' }) {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={PANEL}>
      {title && (
        <div className="flex items-center justify-between px-3.5 py-2 text-[13px] font-bold" style={SLATE_BAR}>
          <span>{title}</span>
          {right != null && <span className="text-[12.5px] font-semibold" style={{ color: '#cfdae4' }}>{right}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/** 패널 안의 한 줄 — 홀짝 배경으로 구분 */
export function Row({ index = 0, children, className = '', ...rest }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 ${className}`}
      style={{
        borderColor: 'var(--mpl-card-line)',
        background: index % 2 === 1 ? 'var(--mpl-row)' : 'var(--mpl-card)',
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

const BTN_BASE = 'inline-flex items-center gap-1.5 rounded-lg font-bold transition disabled:opacity-50'

const BTN_STYLE = {
  primary: {
    background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
    color: '#fff',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
  },
  ghost: {
    background: 'var(--mpl-card)',
    color: 'var(--text-muted)',
    boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)',
  },
  danger: {
    background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))',
    color: '#fff',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)',
  },
  dangerGhost: {
    background: 'var(--mpl-card)',
    color: 'var(--mpl-red-to)',
    boxShadow: 'inset 0 0 0 1px #f0c2bd',
  },
}

export function Button({ variant = 'primary', size = 'md', className = '', style, ...rest }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12.5px]' : 'px-3.5 py-2 text-[13px]'
  return (
    <button
      type="button"
      className={`${BTN_BASE} ${pad} hover:brightness-[1.03] ${className}`}
      style={{ ...BTN_STYLE[variant], ...style }}
      {...rest}
    />
  )
}

/** 아이콘 썸네일 (보스·심볼 등) */
export function Thumb({ url, size = 38, rounded = 8 }) {
  return (
    <span
      className="flex items-center justify-center shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: 'linear-gradient(180deg, #f4f7fa, #e6ecf2)',
        boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)',
      }}
    >
      {url
        ? <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
        : <span style={{ color: 'var(--text-dim)', fontSize: size * 0.34 }}>?</span>}
    </span>
  )
}

/** 드래그 핸들 점 6개 */
export function GripIcon({ className = '' }) {
  return (
    <svg width="12" height="18" viewBox="0 0 14 20" fill="currentColor" className={className}>
      <circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" />
      <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" />
      <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" />
    </svg>
  )
}

/** 내용이 없을 때 */
export function EmptyBox({ icon = '📭', text, action }) {
  return (
    <div
      className="rounded-xl border border-dashed p-14 text-center"
      style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)' }}
    >
      <div className="text-4xl mb-3 opacity-30">{icon}</div>
      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
