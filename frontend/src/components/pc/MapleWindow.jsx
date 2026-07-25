/**
 * 메이플 인게임 창 프레임 (남색 타이틀바 + 청회색 몸체 + 밝은 내부 패널)
 * - title: 타이틀바에 노란색으로 표시 (게임처럼 영문 대문자 권장)
 * - tabs: 타이틀바 아래 창 탭 줄 (MapleWindowTab 사용)
 * - flex 레이아웃(내부 스크롤)이 필요하면 className/bodyClassName으로 제어
 */
export default function MapleWindow({ title, titleRight, tabs, children, className = '', bodyClassName = '' }) {
  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col ${className}`}
      style={{
        background: 'var(--mpl-win-body)',
        border: '1px solid rgba(31, 44, 61, 0.4)',
        boxShadow: '0 10px 30px rgba(31, 44, 61, 0.25)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))' }}
      >
        <span
          className="text-sm font-bold"
          style={{ color: 'var(--mpl-title-yellow)', letterSpacing: '1.5px', textShadow: '1px 1px 0 rgba(31,44,61,.6)' }}
        >
          {title}
        </span>
        {titleRight}
      </div>
      {tabs && (
        <div
          className="flex items-end gap-1 px-3 shrink-0"
          style={{ background: 'linear-gradient(180deg, var(--mpl-navy-to), #2b3a4d)' }}
        >
          {tabs}
        </div>
      )}
      <div className="p-3 flex-1 min-h-0 flex flex-col">
        <div
          className={`rounded-[10px] p-3.5 flex-1 min-h-0 ${bodyClassName}`}
          style={{ background: '#eef2f6', boxShadow: 'inset 0 0 0 1px #dbe3ea' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** 창 탭 (인벤토리 탭 스타일 — 비활성 짙은 남색 / 활성 하늘색) */
export function MapleWindowTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-5 pt-2 pb-1.5 rounded-t-lg text-[13px] font-semibold transition"
      style={active ? {
        background: 'linear-gradient(180deg, var(--mpl-sky-from), #41b5e6)',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(31,80,110,.4)',
      } : {
        background: '#3a4a5c',
        color: '#9fb0c1',
      }}
    >
      {children}
    </button>
  )
}
