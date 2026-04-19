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
 */
export function computeCompletion({ remainingSymbols, daily, weeklyPerWeek, extra, dailyDone }) {
  const need = Math.max(remainingSymbols - extra, 0)
  if (need === 0) return { days: 0, date: dayjs().tz(KST).startOf('day').toDate() }
  if (daily <= 0 && weeklyPerWeek <= 0) return { days: null, date: null }

  let acc = 0
  let cursor = dayjs().tz(KST).startOf('day')
  for (let day = 0; day < 3650; day++) {
    if (!(day === 0 && dailyDone)) acc += daily
    if (cursor.day() === 4 && weeklyPerWeek > 0) acc += weeklyPerWeek
    if (acc >= need) return { days: day, date: cursor.toDate() }
    cursor = cursor.add(1, 'day')
  }
  return { days: null, date: null }
}

export const TYPE_ORDER = ['아케인', '어센틱', '그랜드 어센틱']
