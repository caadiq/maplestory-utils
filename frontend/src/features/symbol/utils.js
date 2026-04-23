import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const KST = 'Asia/Seoul'
const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function formatKoreanDate(d) {
  const dj = dayjs(d).tz(KST)
  return `${dj.year()}년 ${String(dj.month() + 1).padStart(2, '0')}월 ${String(dj.date()).padStart(2, '0')}일 (${DOW[dj.day()]})`
}

/**
 * 심볼 완료까지 남은 일수/예상 완료일 계산
 * - 일퀘는 매일, 주간퀘는 매주 목요일 리셋 시 N회분을 한 번에 지급한다고 가정
 * - extra(추가 심볼)는 즉시 적용
 * - dailyDone이면 오늘 일퀘는 이미 받은 걸로 간주 (내일부터 다시 지급)
 * - 주간퀘는 day 0(오늘)이 목요일이어도 지급하지 않음: 주간퀘 획득 드롭다운의
 *   값이 이미 '이번 주에 받은 수량'을 반영한다고 가정. 다음 목요일부터 누적.
 */
export function computeCompletion({ remainingSymbols, daily, weeklyPerWeek, extra, dailyDone }) {
  const need = Math.max(remainingSymbols - extra, 0)
  if (need === 0) return { days: 0, date: dayjs().tz(KST).startOf('day').toDate() }
  if (daily <= 0 && weeklyPerWeek <= 0) return { days: null, date: null }

  let acc = 0
  let cursor = dayjs().tz(KST).startOf('day')
  for (let day = 0; day < 3650; day++) {
    if (!(day === 0 && dailyDone)) acc += daily
    if (day > 0 && cursor.day() === 4 && weeklyPerWeek > 0) acc += weeklyPerWeek
    if (acc >= need) return { days: day, date: cursor.toDate() }
    cursor = cursor.add(1, 'day')
  }
  return { days: null, date: null }
}

export const TYPE_ORDER = ['아케인', '어센틱', '그랜드 어센틱']

// 이벤트 스킬(보약) 보너스 중 해당 심볼 타입에 적용되는 일퀘 증가량 반환
export function eventBonusForType(eventSkill, type) {
  if (!eventSkill) return 0
  if (type === '아케인') return eventSkill.arcane_daily || 0
  if (type === '어센틱' || type === '그랜드 어센틱') return eventSkill.authentic_daily || 0
  return 0
}
