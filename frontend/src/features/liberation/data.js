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
export const QUEST_BOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/liberation/genesis/quest'
// 주간/월간 보스 초상화 (해방용)
export const LIBERATION_BOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/liberation/genesis/boss'

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
    key: 'jinhilla', name: '진 힐라', image: '진 힐라.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 45 },
      { key: 'hard', label: '하드', points: 90 },
    ],
  },
  {
    key: 'darknell', name: '듄켈', image: '듄켈.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 25 },
      { key: 'hard', label: '하드', points: 75 },
    ],
  },
]

// 월간 보스
export const MONTHLY_BOSSES = [
  {
    key: 'blackmage', name: '검은 마법사', image: '검은 마법사.webp',
    difficulties: [
      { key: 'hard', label: '하드', points: 600 },
      { key: 'extreme', label: '익스트림', points: 600 },
    ],
  },
]

export const BOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/crystal/boss'
export const DIFFICULTY_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/crystal/difficulty'

// ── 데스티니 해방 (6단계, 총 45,000) ──
// phase 1: 선택받은 세렌 / 감시자 칼로스 / 카링
// phase 2: 최초의 대적자 / 림보 / 발드릭스
export const DESTINY_CHAPTERS = [
  { idx: 0, phase: 1, boss: '선택받은 세렌',
    quest_name: '결전, 선택받은 세렌', boss_label: '하드 세렌',
    penalty: '최종 데미지 80% 감소', required: 2000 },
  { idx: 1, phase: 1, boss: '감시자 칼로스',
    quest_name: '결전, 감시자 칼로스', boss_label: '카오스 칼로스',
    penalty: '데스 카운트 3으로 감소', required: 2500 },
  { idx: 2, phase: 1, boss: '카링',
    quest_name: '결전, 사도 카링', boss_label: '하드 카링',
    penalty: '최종 데미지 20% 증가', required: 3000 },
  { idx: 3, phase: 2, boss: '최초의 대적자',
    quest_name: '결전, 최초의 대적자', boss_label: '하드 대적자',
    penalty: '최종 데미지 20% 감소 / 피격 시 질서의 힘 감소량 50% 증가', required: 10000 },
  { idx: 4, phase: 2, boss: '림보',
    quest_name: '결전, 사도 림보', boss_label: '하드 림보',
    penalty: '침식 수치 800으로 시작', required: 12500 },
  { idx: 5, phase: 2, boss: '발드릭스',
    quest_name: '결전, 사도 발드릭스', boss_label: '하드 발드릭스',
    penalty: '피격 시 받는 데미지 30% 증가', required: 15000 },
]

export const DESTINY_TOTAL = DESTINY_CHAPTERS.reduce((s, c) => s + c.required, 0) // 45,000
// 1차 해방(제네시스 무기 → 데스티니 무기 전승)까지 필요한 결의. 2차는 추가 강화
export const DESTINY_PRIMARY_TOTAL = DESTINY_CHAPTERS.filter((c) => c.phase === 1).reduce((s, c) => s + c.required, 0) // 7,500

// 데스티니 포인트 획득 보스 (대적자의 결의 / 1인격파 기준)
export const DESTINY_BOSSES = [
  { key: 'seren', name: '선택받은 세렌', image: '선택받은 세렌.webp',
    difficulties: [
      { key: 'hard', label: '하드', points: 6 },
      { key: 'extreme', label: '익스트림', points: 80 },
    ] },
  { key: 'kalos', name: '감시자 칼로스', image: '감시자 칼로스.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 10 },
      { key: 'chaos', label: '카오스', points: 70 },
      { key: 'extreme', label: '익스트림', points: 400 },
    ] },
  { key: 'kaling', name: '카링', image: '카링.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 20 },
      { key: 'hard', label: '하드', points: 160 },
      { key: 'extreme', label: '익스트림', points: 1200 },
    ] },
  { key: 'limbo', name: '림보', image: '림보.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 120 },
      { key: 'hard', label: '하드', points: 360 },
    ] },
  { key: 'baldrix', name: '발드릭스', image: '발드릭스.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 150 },
      { key: 'hard', label: '하드', points: 450 },
    ] },
  { key: 'firstadversary', name: '최초의 대적자', image: '최초의 대적자.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 15 },
      { key: 'hard', label: '하드', points: 120 },
      { key: 'extreme', label: '익스트림', points: 500 },
    ] },
  { key: 'brilliantvillain', name: '찬란한 흉성', image: '찬란한 흉성.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 20 },
      { key: 'hard', label: '하드', points: 380 },
    ] },
  { key: 'jupiter', name: '유피테르', image: '유피테르.webp',
    difficulties: [
      { key: 'normal', label: '노말', points: 160 },
      { key: 'hard', label: '하드', points: 500 },
    ] },
]

export const DESTINY_BOSS_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/liberation/destiny/boss'
export const DESTINY_QUEST_IMAGE_BASE = 'https://s3.caadiq.co.kr/maplestory/liberation/destiny/quest'

// 파티 인원수로 점수 분배 (버림)
export function calcPoints(basePoints, partySize) {
  return Math.floor(basePoints / partySize)
}

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const KST = 'Asia/Seoul'

export function formatDate(date) {
  return dayjs(date).tz(KST).format('YYYY-MM-DD')
}

export function todayKST() {
  return dayjs().tz(KST).startOf('day').toDate()
}
