// 난이도 정의 (key, label, color)
export const DIFFICULTIES = [
  { key: 'easy', label: '이지', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { key: 'normal', label: '노말', color: 'text-gray-300 border-gray-500/30 bg-gray-500/10' },
  { key: 'hard', label: '하드', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { key: 'chaos', label: '카오스', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { key: 'extreme', label: '익스트림', color: 'text-red-500 border-red-500/30 bg-red-500/10' },
]

export function formatMeso(n) {
  if (!n || n < 10000) return (n || 0).toLocaleString()
  if (n >= 100_000_000) {
    const uk = Math.floor(n / 100_000_000)
    const man = Math.floor((n % 100_000_000) / 10_000)
    return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`
  }
  return `${Math.floor(n / 10_000).toLocaleString()}만`
}

// difficulty 이미지 URL (S3)
export const DIFFICULTY_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/crystal/difficulty'
export function getDifficultyImageUrl(key) {
  return `${DIFFICULTY_IMAGE_BASE}/${key}.webp`
}
