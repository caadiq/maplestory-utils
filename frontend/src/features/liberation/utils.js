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
 * 제네시스 패스 배수 함수 생성. 적용 기간(start~end) 안에 떨어지는 타임스탬프엔 배수를,
 * 기간 밖이거나 패스 미적용이면 1을 반환한다. 완료일 시뮬레이션과 총합 표시가 같은 규칙을 쓰도록 공유.
 * @param {?object} pass { multiplier, startDate, endDate }
 * @returns {(ms:number)=>number}
 */
export function makePassMultiplier(pass) {
  if (!pass || !(pass.multiplier > 1)) return () => 1
  const startMs = pass.startDate ? dayjs(pass.startDate).tz(KST).startOf('day').valueOf() : -Infinity
  const endMs = pass.endDate ? dayjs(pass.endDate).tz(KST).endOf('day').valueOf() : Infinity
  const mult = pass.multiplier
  return (ms) => (ms >= startMs && ms <= endMs ? mult : 1)
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
 * @param {?object} params.pass - 제네시스 패스 적용 시 { multiplier, startDate, endDate }. 미적용이면 null
 * @returns {Date|null}
 */
export function computeCompletionDate({
  calcMode, state, alreadyDone, remaining,
  weeklyEarn, doneEarn, monthlyEarn, monthlyDoneThisMonth,
  bosses = WEEKLY_BOSSES,
  monthlyBoss = MONTHLY_BOSSES[0],
  makeEmptyConfig = makeEmptyWeekly,
  pass = null,
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
    const week1Cfg = sw[0]?.config || makeEmptyConfig()
    const w1Weekly = calcWeekPoints(week1Cfg, bosses)
    const w1Done = calcDoneEarn(week1Cfg, bosses)
    events.push({ date: startKST, amount: Math.max(w1Weekly - w1Done, 0) })

    // 2주차 이후: 각 목요일에 해당 주차 설정의 주간 합 적립
    // 마지막 주차 이후로는 마지막 주차 설정 반복 적용
    let nextThu = startKST.add(daysToNextThu, 'day')
    for (let i = 1; i < 520; i++) {
      const cfg = sw[i]?.config || sw[sw.length - 1]?.config || makeEmptyConfig()
      events.push({ date: nextThu, amount: calcWeekPoints(cfg, bosses) })
      nextThu = nextThu.add(1, 'week')
    }

    // 월간 보스: 슬롯 배정에 따라 해당 주차 첫날(or 1주차이면 시작일)에 적립
    const claimed = {}
    if (monthlyBoss) {
      sw.forEach((w, i) => {
        const diff = w.config.blackMage?.difficulty
        if (!diff || diff === 'none') return
        const range = getSchedulerWeekRange(state.startDate, i + 1)
        const months = [range.start.format('YYYY-MM'), range.end.format('YYYY-MM')]
        for (const m of months) {
          if (!(m in claimed)) {
            claimed[m] = {
              weekIdx: i,
              earn: bossEarn(monthlyBoss, w.config.blackMage),
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
    }

    // 마지막 주차 이후로는 마지막 주차의 월간 설정을 매월 반복 적용
    const lastCfg = sw[sw.length - 1]?.config
    const lastBmEarn = monthlyBoss && lastCfg ? bossEarn(monthlyBoss, lastCfg.blackMage) : 0
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

    // 시작일이 과거면 오늘부터 시뮬레이션. (시작일~오늘 사이 이미 지난 주간/월간 보스가
    // 미래 획득으로 중복 적립되어 완료일이 실제보다 빨라지는 것을 방지)
    const todayK = dayjs().tz(KST).startOf('day')
    const simStart = startKST.isAfter(todayK) ? startKST : todayK

    // 기준일 당일: (주간 - 완료된 주간) + (이번 달 월간, 아직 안 잡았을 때)
    const day0Weekly = Math.max(weeklyEarn - doneEarn, 0)
    const day0Monthly = monthlyEarn > 0 && !monthlyDoneThisMonth ? monthlyEarn : 0
    events.push({ date: simStart, amount: day0Weekly + day0Monthly })

    // 다음 목요일부터 매주 주간 적립
    const dow = simStart.day()
    const daysToNextThu = dow < 4 ? 4 - dow : 11 - dow
    let nextThu = simStart.add(daysToNextThu, 'day')
    for (let i = 0; i < 520; i++) {
      events.push({ date: nextThu, amount: weeklyEarn })
      nextThu = nextThu.add(1, 'week')
    }

    // 다음 달 1일부터 매월 월간 적립
    if (monthlyEarn > 0) {
      let nextMonth = simStart.add(1, 'month').startOf('month')
      for (let i = 0; i < 120; i++) {
        events.push({ date: nextMonth, amount: monthlyEarn })
        nextMonth = nextMonth.add(1, 'month')
      }
    }
  }

  // 제네시스 패스: 적용 기간 안에 떨어지는 이벤트는 포인트에 배수 적용
  const passMultAt = makePassMultiplier(pass)

  events.sort((a, b) => a.date.diff(b.date))
  let cumulative = 0
  let lastEventDate = startKST
  for (const e of events) {
    cumulative += e.amount * passMultAt(e.date.valueOf())
    lastEventDate = e.date
    if (cumulative >= remaining) return e.date.toDate()
  }

  // 10년 loop 내에 도달 못 한 경우: 정상 상태 주간 획득량으로 선형 외삽
  // 단순 모드: weeklyEarn / 주차별 모드: 마지막 주차 설정의 주간 합
  const steadyWeekly = calcMode === 'simple'
    ? weeklyEarn
    : calcWeekPoints((state.schedulerWeeks || []).slice(-1)[0]?.config || makeEmptyConfig(), bosses)
  if (steadyWeekly <= 0) return null
  const deficit = remaining - cumulative
  const weeksNeeded = Math.ceil(deficit / steadyWeekly)
  return lastEventDate.add(weeksNeeded * 7, 'day').toDate()
}

/**
 * 주차별 스케줄러의 주차별 적립/누적 분해 (총합 패널 표시용).
 * 월간 보스는 각 달에 한 주차만 선점(겹치는 주차 중 먼저). 패스 기간 안 주차는 배수 적용.
 * 합산 헤더(headerWeekly/headerMonthly)·스케줄러 요약과 동일 규칙을 따른다.
 * @returns {{n:number, weekly:number, monthly:number, cumulative:number}[]}
 */
export function computeSchedulerBreakdown(weeks, startDate, bosses = WEEKLY_BOSSES, monthlyBoss = MONTHLY_BOSSES[0], pass = null) {
  const passMultAt = makePassMultiplier(pass)
  const claimedWeeks = new Set() // 월간 보스를 실제로 적립하는 주차 인덱스(0-based)
  if (monthlyBoss && startDate) {
    const claimedMonths = {}
    weeks.forEach((w, idx) => {
      const diff = w.config.blackMage?.difficulty
      if (!diff || diff === 'none') return
      const r = getSchedulerWeekRange(startDate, idx + 1)
      const months = [r.start.format('YYYY-MM'), r.end.format('YYYY-MM')]
      for (const m of months) {
        if (!(m in claimedMonths)) { claimedMonths[m] = idx; claimedWeeks.add(idx); return }
      }
    })
  }
  let cumulative = 0
  return weeks.map((w, idx) => {
    const n = idx + 1
    const mult = startDate ? passMultAt(getSchedulerWeekRange(startDate, n).start.valueOf()) : 1
    const weekly = calcWeekPoints(w.config, bosses) * mult
    const monthly = monthlyBoss && claimedWeeks.has(idx)
      ? bossEarn(monthlyBoss, w.config.blackMage) * mult
      : 0
    cumulative += weekly + monthly
    return { n, weekly, monthly, cumulative }
  })
}
