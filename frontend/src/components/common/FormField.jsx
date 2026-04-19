/**
 * 관리자 폼 공용 필드 래퍼
 * <FormField label="제목" required hint="설명" error={errors.title}>
 *   <input ... />
 * </FormField>
 */
export default function FormField({ label, hint, error, required, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium" style={{ color: 'var(--text-emphasis)' }}>
          {label} {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
        </label>
        {hint && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{hint}</span>}
      </div>
      {children}
      {error && <div className="text-[11px]" style={{ color: 'var(--danger-text)' }}>{error}</div>}
    </div>
  )
}

/**
 * 관리자 폼 공용 input 스타일
 */
export const formInputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]'

export const formInputStyle = {
  background: 'var(--input-bg)',
  borderColor: 'var(--input-border)',
  color: 'var(--text-strong)',
}
