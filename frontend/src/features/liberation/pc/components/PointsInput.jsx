import { useState, useEffect } from 'react'

/**
 * 포인트 입력 (3자리 쉼표, 최대 4자리, 0이면 포커스 시 지움)
 */
export default function PointsInput({ value, onChange, max = 9999, className = '', ...rest }) {
  const [text, setText] = useState(() => (value > 0 ? value.toLocaleString() : '0'))

  useEffect(() => {
    setText(value > 0 ? value.toLocaleString() : '0')
  }, [value])

  const handleChange = (e) => {
    let digits = e.target.value.replace(/[^\d]/g, '')
    if (digits.length > String(max).length) digits = digits.slice(0, String(max).length)
    const n = digits ? Math.min(Number(digits), max) : 0
    setText(n > 0 ? n.toLocaleString() : digits === '' ? '' : '0')
    onChange(n)
  }

  const handleFocus = (e) => {
    // 0인 상태에서 포커스되면 지움
    if (value === 0 || text === '0') {
      setText('')
    }
    e.target.select()
  }

  const handleBlur = () => {
    if (text === '' || text === '0') setText('0')
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      {...rest}
    />
  )
}
