// 제네시스 해방 챕터 (8단계, 총 6,500)
// phase 1: 반레온/아카이럼/매그너스/스우 (1차 해방)
// phase 2: 데미안/윌/루시드/진힐라 (2차 해방)
export const GENESIS_CHAPTERS = [
  { idx: 0, phase: 1, boss: '반 레온', required: 500 },
  { idx: 1, phase: 1, boss: '아카이럼', required: 500 },
  { idx: 2, phase: 1, boss: '매그너스', required: 500 },
  { idx: 3, phase: 1, boss: '스우', required: 1000 },
  { idx: 4, phase: 2, boss: '데미안', required: 1000 },
  { idx: 5, phase: 2, boss: '윌', required: 1000 },
  { idx: 6, phase: 2, boss: '루시드', required: 1000 },
  { idx: 7, phase: 2, boss: '진 힐라', required: 1000 },
]

// 퀘스트 이미지 경로 (제네시스)
export const QUEST_BOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/liberation/genesis/quest/boss'
export const QUEST_BTBOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/liberation/genesis/quest/btboss'

export const GENESIS_TOTAL = GENESIS_CHAPTERS.reduce((s, c) => s + c.required, 0) // 6500

// 주간 보스 (주 1회)
export const WEEKLY_BOSSES = [
  {
    key: 'lotus', name: '스우', image: '스우.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 10 },
      { key: 'hard', label: '하드', points: 50 },
      { key: 'extreme', label: '익스트림', points: 50 },
    ],
  },
  {
    key: 'damien', name: '데미안', image: '데미안.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 10 },
      { key: 'hard', label: '하드', points: 50 },
    ],
  },
  {
    key: 'lucid', name: '루시드', image: '루시드.webp',
    difficulties: [
      { key: 'easy', label: '이지', points: 15 },
      { key: 'normal', label: '노말', points: 20 },
      { key: 'hard', label: '하드', points: 65 },
    ],
  },
  {
    key: 'will', name: '윌', image: '윌.webp',
    difficulties: [
      { key: 'easy', label: '이지', points: 15 },
      { key: 'normal', label: '노말', points: 25 },
      { key: 'hard', label: '하드', points: 75 },
    ],
  },
  {
    key: 'dusk', name: '더스크', image: '더스크.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 20 },
      { key: 'chaos', label: '카오스', points: 65 },
    ],
  },
  {
    key: 'darknell', name: '듄켈', image: '듄켈.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 25 },
      { key: 'hard', label: '하드', points: 75 },
    ],
  },
  {
    key: 'jinhilla', name: '진 힐라', image: '진힐라.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 45 },
      { key: 'hard', label: '하드', points: 90 },
    ],
  },
]

// 월간 보스
export const MONTHLY_BOSSES = [
  {
    key: 'blackmage', name: '검은 마법사', image: '검은마법사.webp',
    difficulties: [
      { key: 'hard', label: '하드', points: 600 },
      { key: 'extreme', label: '익스트림', points: 600 },
    ],
  },
]

export const BOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/crystal/boss'
export const DIFFICULTY_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/crystal/difficulty'

// 파티 인원수로 점수 분배 (버림)
export function calcPoints(basePoints, partySize) {
  return Math.floor(basePoints / partySize)
}

// 목요일 기준 주차 계산 (KST)
// 이번 주 목요일 자정 = 이번 주의 시작
export function getThursdayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=일, 4=목
  // 직전 목요일 찾기 (오늘이 목요일이면 오늘)
  const diff = (day - 4 + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addWeeks(date, weeks) {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}
