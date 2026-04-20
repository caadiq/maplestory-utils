import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function ChevronIcon({ dir = 'down', size = 16, className = '' }) {
  const rotate = { left: 90, right: -90, up: 180, down: 0 }[dir] || 0
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${rotate}deg)` }} className={className}>
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 다크 테마 커스텀 DatePicker
 * @param {string} value - "YYYY-MM-DD"
 * @param {function} onChange
 * @param {number} minYear
 */
export default function DatePicker({ value, onChange, placeholder = '날짜 선택', minYear = 2020 }) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState('days')
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value) : new Date()))
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false)
        setViewMode('days')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { if (value) setViewDate(new Date(value)) }, [value])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const groupIndex = Math.floor((year - minYear) / 12)
  const startYear = minYear + groupIndex * 12
  const years = Array.from({ length: 12 }, (_, i) => startYear + i)
  const canGoPrevYearRange = startYear > minYear

  const stop = (e, cb) => { e.preventDefault(); e.stopPropagation(); cb() }

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1)
    if (d.getFullYear() >= minYear) setViewDate(d)
  }
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))
  const prevYearRange = () => canGoPrevYearRange && setViewDate(new Date(startYear - 12, month, 1))
  const nextYearRange = () => setViewDate(new Date(startYear + 12, month, 1))

  const selectDate = (day) => {
    const s = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(s)
    setIsOpen(false)
    setViewMode('days')
  }

  const selectYear = (y) => setViewDate(new Date(y, month, 1))
  const selectMonth = (m) => { setViewDate(new Date(year, m, 1)); setViewMode('days') }

  const DOW = ['일', '월', '화', '수', '목', '금', '토']
  const formatDisplay = (s) => {
    if (!s) return ''
    const [y, m, d] = s.split('-')
    const dow = DOW[new Date(`${s}T00:00:00+09:00`).getDay()]
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dow})`
  }

  const isSelected = (day) => {
    if (!value || !day) return false
    const [y, m, d] = value.split('-')
    return parseInt(y) === year && parseInt(m) === month + 1 && parseInt(d) === day
  }
  const isToday = (day) => {
    if (!day) return false
    const t = new Date()
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
  }

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => stop(e, () => setIsOpen(!isOpen))}
        className="w-full h-12 rounded-lg border px-4 text-base flex items-center justify-between"
        style={{
          background: 'var(--input-bg)',
          borderColor: isOpen ? 'var(--input-border-focus)' : 'var(--input-border)',
        }}
      >
        <span style={{ color: value ? 'var(--text-strong)' : 'var(--input-placeholder)' }}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          style={{ color: 'var(--input-icon)' }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 left-0 rounded-xl border p-5"
            style={{
              width: 420,
              background: 'var(--popup-bg)',
              borderColor: 'var(--popup-border)',
              boxShadow: 'var(--popup-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={(e) => stop(e, viewMode === 'years' ? prevYearRange : prevMonth)}
                disabled={viewMode === 'years' ? !canGoPrevYearRange : (year === minYear && month === 0)}
                className="p-1.5 rounded hover:bg-[var(--row-hover-bg)] disabled:opacity-30"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronIcon dir="left" size={18} />
              </button>
              <button
                type="button"
                onClick={(e) => stop(e, () => setViewMode(viewMode === 'days' ? 'years' : 'days'))}
                className="flex items-center gap-1 text-sm font-medium hover:text-[var(--accent-bright)]"
                style={{ color: 'var(--text-emphasis)' }}
              >
                {viewMode === 'years' ? `${years[0]} - ${years[years.length - 1]}` : `${year}년 ${month + 1}월`}
                <ChevronIcon dir={viewMode !== 'days' ? 'up' : 'down'} size={14} className="transition-transform" />
              </button>
              <button
                type="button"
                onClick={(e) => stop(e, viewMode === 'years' ? nextYearRange : nextMonth)}
                className="p-1.5 rounded hover:bg-[var(--row-hover-bg)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronIcon dir="right" size={18} />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {viewMode === 'years' ? (
                <motion.div key="years" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                  <div className="text-center text-xs mb-2" style={{ color: 'var(--text-dim)' }}>연도</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginBottom: '12px' }}>
                    {years.map((y) => {
                      const isActive = year === y
                      const isCurrent = currentYear === y && !isActive
                      return (
                        <button
                          key={y}
                          type="button"
                          onClick={(e) => stop(e, () => selectYear(y))}
                          className="py-2 rounded-lg text-sm hover:bg-[var(--row-hover-bg)]"
                          style={isActive ? {
                            background: 'var(--btn-primary-bg)',
                            color: 'var(--btn-primary-text)',
                          } : {
                            color: isCurrent ? 'var(--accent-bright)' : 'var(--text-emphasis)',
                          }}
                        >
                          {y}
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-center text-xs mb-2" style={{ color: 'var(--text-dim)' }}>월</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
                    {monthNames.map((m, i) => {
                      const isActive = month === i
                      const isCurrent = (currentYear === year && currentMonth === i) && !isActive
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={(e) => stop(e, () => selectMonth(i))}
                          className="py-2 rounded-lg text-sm hover:bg-[var(--row-hover-bg)]"
                          style={isActive ? {
                            background: 'var(--btn-primary-bg)',
                            color: 'var(--btn-primary-text)',
                          } : {
                            color: isCurrent ? 'var(--accent-bright)' : 'var(--text-emphasis)',
                          }}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="days" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', marginBottom: '8px' }}>
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                      <div
                        key={d}
                        className="text-center text-xs font-medium py-1"
                        style={{
                          color: i === 0 ? 'var(--danger-text)' : i === 6 ? '#60a5fa' : 'var(--text-dim)',
                          opacity: i === 0 || i === 6 ? 0.8 : 1,
                        }}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
                    {days.map((day, i) => {
                      const dw = i % 7
                      const selected = isSelected(day)
                      const today = isToday(day)
                      const textColor = today && !selected ? 'var(--accent-bright)'
                        : day && !selected && !today && dw === 0 ? 'var(--danger-text)'
                        : day && !selected && !today && dw === 6 ? '#60a5fa'
                        : day && !selected && !today ? 'var(--text-emphasis)'
                        : undefined
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={!day}
                          onClick={(e) => day && stop(e, () => selectDate(day))}
                          style={{
                            aspectRatio: '1 / 1',
                            background: selected ? 'var(--btn-primary-bg)' : undefined,
                            color: selected ? 'var(--btn-primary-text)' : textColor,
                            fontWeight: today && !selected ? 'bold' : undefined,
                          }}
                          className={`rounded-full text-base font-medium flex items-center justify-center
                            ${!day ? '' : 'hover:bg-[var(--row-hover-bg)]'}
                          `}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
