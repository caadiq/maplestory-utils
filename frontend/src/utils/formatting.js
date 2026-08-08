/**
 * 메소를 "N억 N,NNN만" 형식의 한국어 문자열로 반환
 * formatMeso(123456789) → "1억 2,345만"
 * formatMeso(10000) → "1만"
 * formatMeso(500) → "500"
 * formatMeso(0) → "0"
 */
export function formatMeso(n) {
  const v = Number(n) || 0
  if (v <= 0) return '0'
  const eok = Math.floor(v / 100_000_000)
  const man = Math.floor((v % 100_000_000) / 10_000)
  const parts = []
  if (eok) parts.push(`${eok.toLocaleString()}억`)
  if (man) parts.push(`${man.toLocaleString()}만`)
  return parts.length ? parts.join(' ') : v.toLocaleString()
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']

/**
 * "YYYY-MM-DD" (KST 날짜 문자열) → "YYYY년 MM월 DD일 (요일)".
 * 요일은 KST 자정 기준으로 계산한다.
 */
export function formatKoreanDate(s) {
  const [y, m, d] = s.split('-')
  const dow = DOW[new Date(`${s}T00:00:00+09:00`).getDay()]
  return `${y}년 ${m}월 ${d}일 (${dow})`
}
