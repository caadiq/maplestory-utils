// 난이도 정의 (key, label, color) — 색상은 게임 내 난이도 배지 이미지와 매치
export const DIFFICULTIES = [
  { key: 'easy', label: '이지', color: 'text-slate-300 border-slate-400/40 bg-slate-400/10' },
  { key: 'normal', label: '노말', color: 'text-sky-300 border-sky-400/40 bg-sky-400/10' },
  { key: 'hard', label: '하드', color: 'text-pink-300 border-pink-400/40 bg-pink-400/10' },
  { key: 'chaos', label: '카오스', color: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  { key: 'extreme', label: '익스트림', color: 'text-red-400 border-red-500/40 bg-red-500/10' },
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
