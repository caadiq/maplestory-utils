/**
 * 커스텀 체크박스
 * <Checkbox checked={x} onChange={(checked) => ...} />
 */
export default function Checkbox({ checked, onChange, disabled, className = '', size = 'md', tabIndex }) {
  const sizeCls = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const iconSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={(e) => { e.stopPropagation(); !disabled && onChange?.(!checked) }}
      className={`${sizeCls} shrink-0 rounded-md border-2 flex items-center justify-center transition ${
        checked
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-white/20 bg-gray-950 hover:border-white/40'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {checked && (
        <svg className={iconSize} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}
