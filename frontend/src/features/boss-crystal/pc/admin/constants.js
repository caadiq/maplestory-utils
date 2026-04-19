// 난이도 정의 (key, label, initial, colors)
export const DIFFICULTIES = [
  {
    key: 'easy', label: '이지', initial: 'E',
    colors: { border: '#999999', bg: '#999999', text: '#ffffff' },
  },
  {
    key: 'normal', label: '노말', initial: 'N',
    colors: { border: '#33aabb', bg: '#33aabb', text: '#ffffff' },
  },
  {
    key: 'hard', label: '하드', initial: 'H',
    colors: { border: '#dd4489', bg: '#dd4489', text: '#ffffff' },
  },
  {
    key: 'chaos', label: '카오스', initial: 'C',
    colors: { border: '#ddbb88', bg: '#444444', text: '#ffddbb' },
  },
  {
    key: 'extreme', label: '익스트림', initial: 'E',
    colors: { border: '#ee3355', bg: '#444444', text: '#ee4455' },
  },
]

export function getDifficultyBadgeStyle(key) {
  const diff = DIFFICULTIES.find((d) => d.key === key)
  if (!diff) return {}
  return {
    borderColor: diff.colors.border,
    backgroundColor: diff.colors.bg,
    color: diff.colors.text,
  }
}

// formatMeso는 utils/formatting 에서 재-export (모든 기능 공통)
export { formatMeso } from '../../../../utils/formatting'

// difficulty 이미지 URL (S3)
export const DIFFICULTY_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/crystal/difficulty'
export function getDifficultyImageUrl(key) {
  return `${DIFFICULTY_IMAGE_BASE}/${key}.webp`
}
