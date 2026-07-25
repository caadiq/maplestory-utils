/**
 * 메이플 인게임 창 프레임 (남색 타이틀바 + 청회색 몸체 + 밝은 내부 패널)
 * - title: 타이틀바에 노란색으로 표시 (게임처럼 영문 대문자 권장)
 * - flex 레이아웃(내부 스크롤)이 필요하면 className/bodyClassName으로 제어
 */
export default function MapleWindow({ title, titleRight, children, className = '', bodyClassName = '' }) {
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
