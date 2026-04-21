import dayjs from 'dayjs'
import { WEEKLY_BOSSES, MONTHLY_BOSSES, calcPoints, todayKST } from './data'
import { makeEmptyWeekly } from './store'

const KST = 'Asia/Seoul'

export function bossEarn(boss, sel) {
  if (!sel) return 0
  const d = boss.difficulties.find((x) => x.key === sel.difficulty)
  if (!d) return 0
  return calcPoints(d.points, sel.party)
}

export function calcWeekPoints(weekData, bosses = WEEKLY_BOSSES) {
  let points = 0
  bosses.forEach((b) => {
    points += bossEarn(b, weekData.bosses[b.key])
  })
  return points
}

export function calcDoneEarn(weekData, bosses = WEEKLY_BOSSES) {
  let points = 0
  bosses.forEach((b) => {
    const sel = weekData.bosses[b.key]
    if (sel?.done) points += bossEarn(b, sel)
  })
  return points
}

export function calcMonthlyEarn(weekData) {
  return bossEarn(MONTHLY_BOSSES[0], weekData.blackMage)
}

/**
 * 주차 번호(1-based)로 해당 주차의 날짜 범위 반환
 * 1주차: 시작일 ~ 다음 목요일 전날
 * 2주차+: 이전 주차 목요일부터 6일간
 */
export function getSchedulerWeekRange(startDateStr, weekIdx) {
  const start = dayjs(startDateStr).tz(KST).startOf('day')
  const dow = start.day()
  const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
  const nextThu = start.add(daysToNextThu, 'day')
  if (weekIdx === 1) return { start, end: nextThu.subtract(1, 'day') }
  const ws = nextThu.add((weekIdx - 2) * 7, 'day')
  return { start: ws, end: ws.add(6, 'day') }
}

/**
 * 해방일 계산: 시작일부터 포인트 이벤트를 시뮬레이션하여 remaining 도달 시점 반환
 *
 * @param {object} params
 * @param {'simple'|'weekly'} params.calcMode
 * @param {object} params.state  - 현재 슬롯(startDate, schedulerWeeks, weekly 등)
 * @param {boolean} params.alreadyDone
 * @param {number}  params.remaining
 * @param {number}  params.weeklyEarn
 * @param {number}  params.doneEarn
 * @param {number}  params.monthlyEarn
 * @param {boolean} params.monthlyDoneThisMonth
 * @returns {Date|null}
 */
export function computeCompletionDate({
  calcMode, state, alreadyDone, remaining,
  weeklyEarn, doneEarn, monthlyEarn, monthlyDoneThisMonth,
}) {
  if (alreadyDone) return todayKST()
  if (remaining <= 0) return dayjs(state.startDate).tz(KST).startOf('day').toDate()

  const startKST = dayjs(state.startDate).tz(KST).startOf('day')
  const events = []

  if (calcMode === 'weekly') {
    const sw = state.schedulerWeeks || []
    if (sw.length === 0) return null
    const dow = startKST.day()
    const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow

    // 1주차: 시작일 당일에 (주간 - done) 적립
    const week1Cfg = sw[0]?.config || makeEmptyWeekly()
    const w1Weekly = calcWeekPoints(week1Cfg)
    const w1Done = calcDoneEarn(week1Cfg)
    events.push({ date: startKST, amount: Math.max(w1Weekly - w1Done, 0) })

    // 2주차 이후: 각 목요일에 해당 주차 설정의 주간 합 적립
    // 마지막 주차 이후로는 마지막 주차 설정 반복 적용
    let nextThu = startKST.add(daysToNextThu, 'day')
    for (let i = 1; i < 520; i++) {
      const cfg = sw[i]?.config || sw[sw.length - 1]?.config || makeEmptyWeekly()
      events.push({ date: nextThu, amount: calcWeekPoints(cfg) })
      nextThu = nextThu.add(1, 'week')
    }

    // 검은 마법사: 슬롯 배정에 따라 해당 주차 첫날(or 1주차이면 시작일)에 적립
    const claimed = {}
    sw.forEach((w, i) => {
      const diff = w.config.blackMage?.difficulty
      if (!diff || diff === 'none') return
      const range = getSchedulerWeekRange(state.startDate, i + 1)
      const months = [range.start.format('YYYY-MM'), range.end.format('YYYY-MM')]
      for (const m of months) {
        if (!(m in claimed)) {
          claimed[m] = {
            weekIdx: i,
            earn: bossEarn(MONTHLY_BOSSES[0], w.config.blackMage),
            done: !!w.config.blackMage.done,
          }
          return
        }
      }
    })
    Object.entries(claimed).forEach(([, info]) => {
      if (info.done) return
      const wIdx = info.weekIdx
      const date = wIdx === 0
        ? startKST
        : startKST.add(daysToNextThu + (wIdx - 1) * 7, 'day')
      events.push({ date, amount: info.earn })
    })

    // 마지막 주차 이후로는 마지막 주차의 검은 마법사 설정을 매월 반복 적용
    const lastCfg = sw[sw.length - 1]?.config
    const lastBmEarn = lastCfg ? bossEarn(MONTHLY_BOSSES[0], lastCfg.blackMage) : 0
    if (lastBmEarn > 0) {
      const lastWeekStart = sw.length === 1
        ? startKST
        : startKST.add(daysToNextThu + (sw.length - 2) * 7, 'day')
      const claimedMonths = new Set(Object.keys(claimed))
      let cursor = lastWeekStart.add(1, 'month').startOf('month')
      for (let i = 0; i < 120; i++) {
        const m = cursor.format('YYYY-MM')
        if (!claimedMonths.has(m)) {
          events.push({ date: cursor, amount: lastBmEarn })
        }
        cursor = cursor.add(1, 'month')
      }
    }
  } else {
    // 단순 계산 모드: 매주 동일 설정
    if (weeklyEarn === 0 && monthlyEarn === 0) return null

    // 시작일 당일: (주간 - 완료된 주간) + (이번 달 월간, 아직 안 잡았을 때)
    const day0Weekly = Math.max(weeklyEarn - doneEarn, 0)
    const day0Monthly = monthlyEarn > 0 && !monthlyDoneThisMonth ? monthlyEarn : 0
    events.push({ date: startKST, amount: day0Weekly + day0Monthly })

    // 다음 목요일부터 매주 주간 적립
    const dow = startKST.day()
    const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
    let nextThu = startKST.add(daysToNextThu, 'day')
    for (let i = 0; i < 520; i++) {
      events.push({ date: nextThu, amount: weeklyEarn })
      nextThu = nextThu.add(1, 'week')
    }

    // 다음 달 1일부터 매월 월간 적립
    if (monthlyEarn > 0) {
      let nextMonth = startKST.add(1, 'month').startOf('month')
      for (let i = 0; i < 120; i++) {
        events.push({ date: nextMonth, amount: monthlyEarn })
        nextMonth = nextMonth.add(1, 'month')
      }
    }
  }

  events.sort((a, b) => a.date.diff(b.date))
  let cumulative = 0
  for (const e of events) {
    cumulative += e.amount
    if (cumulative >= remaining) return e.date.toDate()
  }
  return null
}
