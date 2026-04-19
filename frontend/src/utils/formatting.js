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

// 과거 이름 alias (symbol에서 formatMesoKorean으로 쓰던 것)
export const formatMesoKorean = formatMeso
