/**
 * 기존 호환용 래퍼. 실제 툴팁 표시는 GlobalTooltip 이 담당.
 *
 *   <Tooltip text="설명" placement="top" delay={200}>
 *     <button>+</button>
 *   </Tooltip>
 *
 * 새 코드는 그냥 `title="..."` 를 직접 써도 됨.
 */
export default function Tooltip({ text, children, placement = 'top', delay = 200 }) {
  if (!text) return children
  return (
    <span
      title={text}
      data-tooltip-placement={placement}
      data-tooltip-delay={delay}
      className="inline-block"
    >
      {children}
    </span>
  )
}
