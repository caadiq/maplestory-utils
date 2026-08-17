import { useState } from 'react'

/**
 * 소수 입력.
 *
 * 값을 숫자로만 들고 있으면 "0."을 칠 수 없다 — parseFloat("0.")이 0이라
 * 점을 찍는 순간 상태가 0으로 덮이고 화면의 점이 지워진다.
 * 그래서 편집 중에는 사용자가 친 문자열을 그대로 두고, 숫자는 따로 올려보낸다.
 * 포커스를 벗어나면 정규화된 숫자로 돌아간다.
 */
export function DecimalInput({ value, onChange, max = 100, className, style }) {
  const [text, setText] = useState(null)   // null이면 '편집 중 아님'

  const handle = (raw) => {
    // 숫자와 점만, 점은 하나만 남긴다
    let v = raw.replace(/[^\d.]/g, '')
    const first = v.indexOf('.')
    if (first !== -1) v = v.slice(0, first + 1) + v.slice(first + 1).replace(/\./g, '')
    const num = v === '' || v === '.' ? 0 : Math.min(parseFloat(v) || 0, max)
    // 상한을 넘겼으면 보정된 값을 화면에도 반영한다
    setText(parseFloat(v) > max ? String(max) : v)
    onChange(num)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text ?? String(value ?? 0)}
      onChange={(e) => handle(e.target.value)}
      onFocus={(e) => setText(e.target.value)}
      onBlur={() => setText(null)}
      className={className}
      style={style}
    />
  )
}

/**
 * 게임창 스타일 공용 입력/레이아웃 위젯.
 *
 * 여러 기능(헥사·보스…)이 같은 모양의 숫자 입력·세그먼트·토글·카드 헤더를 쓴다.
 * 도메인 지식이 없는 순수 위젯이라 특정 기능 폴더가 아니라 여기에 둔다.
 */

/** 카드 배경·테두리 (게임창 안쪽 패널) */
export const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }

/** 섹션 제목 바(슬레이트) 스타일 */
export const SLATE_TITLE = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}

export function NumInput({ value, onChange, min = 0, max = 9999, chars = 2, unit }) {
  const clamp = (v) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min))
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"
      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0))}
        className="bg-transparent outline-none text-right font-bold tabular-nums text-sm pr-[3px]"
        style={{ width: `${chars + 1.5}ch`, color: 'var(--text-strong)' }}
      />
      {unit && <span className="text-[12.5px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{unit}</span>}
    </div>
  )
}

export function Seg({ options, value, onChange, disabled }) {
  return (
    <div
      className="inline-flex rounded-lg overflow-hidden border text-[12.5px] font-bold"
      style={{ borderColor: 'var(--input-border)', opacity: disabled ? 0.45 : 1 }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className="px-3 py-2 disabled:cursor-not-allowed whitespace-nowrap"
          style={!disabled && o.value === value
            ? { background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))', color: '#fff' }
            : { background: 'var(--input-bg)', color: 'var(--text-muted)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, children, light }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-[13px] font-bold" style={{ color: light ? '#e8f2d9' : 'var(--text-muted)' }}>
      {children}
      <span
        className="relative inline-block w-9 h-5 rounded-full transition-colors"
        style={{ background: on ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' : 'var(--toggle-off, #c3ced9)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 18 : 2 }}
        />
      </span>
    </button>
  )
}

export function SecTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 rounded-t-[10px] text-[13px] font-extrabold tracking-wide" style={SLATE_TITLE}>
      {children}
      {right}
    </div>
  )
}

export function FormRow({ label, sub, children, total }) {
  if (total) {
    return (
      <div
        className="flex items-center justify-between gap-3 py-2.5 text-[13px] border-t -mx-3.5 -mb-1 px-3.5"
        style={{ borderColor: 'var(--mpl-card-line)', background: 'var(--mpl-row)' }}
      >
        <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-[13px] border-t border-dashed first:border-t-0" style={{ borderColor: 'var(--mpl-card-line)' }}>
      <span className="font-bold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
        {label}
        {sub && <span className="ml-1 text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>{sub}</span>}
      </span>
      {children}
    </div>
  )
}
