/**
 * 경험치 계산기 로직
 *
 * 데이터(/api/exp/data)는 전부 게임 원본 정수:
 * - 지역 퀘스트·몬파·주간퀘: 레벨 무관 고정 절대값
 * - 에픽던전·익스몬파·핸즈·사우나·농장·교환권: 레벨별 절대값 테이블
 * - 성장의 비약: 캡 레벨의 1레벨 경험치와 정확히 일치 (캡 미만이면 1레벨 상승)
 *
 * 예측은 하루 단위 시뮬레이션: 레벨이 오르면 레벨 테이블 값도 따라 바뀐다.
 * 주간 컨텐츠는 1/7로 나눠 매일 반영(부드러운 근사), 일회성은 첫날 적용.
 */

export const EPIC_STAGES = [
  { value: 0, label: '기본' },
  { value: 1, label: '1단계' },
  { value: 2, label: '2단계' },
]

/**
 * 몬파 주간 획득 — 입장권은 하루 단위(기본 2매)라 입력은 일일 횟수.
 * 주 7일 중 일요일 하루는 보너스 값으로 자동 반영: 주간 = 일일횟수 × (평일 6일 + 일요일 1일)
 *
 * special=true면 그 주 일요일에 스페셜 썬데이(몬파 클리어 경험치 +250%)가 적용된다.
 * 평일 100% + 일요일 50% + 썬데이 250% = 400% → 데이터의 exp.special(=평일×4)
 */
export function parkWeeklyExp(zone, runsPerDay, special = false) {
  if (!zone || !runsPerDay) return 0
  const sundayExp = special ? zone.exp.special : zone.exp.sunday
  return runsPerDay * (zone.exp.normal * 6 + sundayExp)
}

/**
 * KST 기준 '이번 주 월요일' 날짜 키.
 * 스페셜 썬데이 토글은 켠 주에만 유효하고 월요일 00시(KST)에 자동으로 풀린다.
 */
export function weekKeyKST(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 3600 * 1000)
  const mondayIdx = (kst.getUTCDay() + 6) % 7 // 월=0 … 일=6
  kst.setUTCDate(kst.getUTCDate() - mondayIdx)
  return kst.toISOString().slice(0, 10)
}

/** 저장된 스페셜 썬데이 설정이 지금도 유효한지 (켠 주가 지났으면 false) */
export const parkSpecialActive = (park, weekKey) =>
  !!park?.sundaySpecial && park.sundaySpecialWeek === weekKey

const byLevel = (table, level) => {
  if (!table) return 0
  const v = table[String(level)]
  if (v != null) return v
  // 테이블 범위 밖(최대 레벨 초과)은 마지막 값 유지
  const keys = Object.keys(table)
  if (!keys.length) return 0
  const max = keys[keys.length - 1]
  return level > Number(max) ? table[max] : 0
}

export function defaultSettings(level) {
  return {
    hunt: { pctPerRun: 0, runsPerDay: 0 },
    daily: {}, // zoneId -> false 만 기록 (기본 켜짐)
    weekly: {
      epic: { on: true, dungeon: 'nightmare_paradise', stage: 2 },
      park: { on: true, zone: 'auto', runs: 2, sundaySpecial: false },
      extreme: { on: true },
      mvpHours: 0,
    },
    items: {
      elixirCounts: { e249: 0, e259: 0, e269: 0, e279: 0 },
      e200lv: 0,
      e250lv: 0,
      couponNormal: 0,
      couponUpper: 0,
      vipTickets: 0, // VIP 사우나 이용권 (1개 = 30분)
      farmGolden: 0,
      farmBlue: 0,
      farmMech: 0,
    },
    goal: { level: Math.min(level + 1 || 261, 300) },
  }
}

/** 일퀘 지역이 켜져 있는지 (기본 켜짐, 명시적으로 끈 것만 false) */
export const zoneOn = (daily, id) => daily?.[id] !== false

/** 현재 레벨에서 하루 획득 절대 경험치 (사냥 + 일퀘) */
function dailyExpAt(level, huntAbs, data, s) {
  let sum = huntAbs
  for (const group of ['arcane', 'tenebris', 'grandis']) {
    for (const z of data.daily[group]) {
      if (level >= z.minLevel && zoneOn(s.daily, z.id)) sum += z.exp
    }
  }
  return sum
}

/** 몬파에서 실제 계산에 쓸 구역 (auto = 입장 가능한 최고 구역) */
export function parkZoneAt(level, data, zoneId) {
  const zones = data.monsterPark.zones.filter((z) => level >= z.minLevel)
  if (!zones.length) return null
  if (zoneId && zoneId !== 'auto') {
    const z = zones.find((x) => x.id === zoneId)
    if (z) return z
  }
  return zones[zones.length - 1]
}

/** 현재 레벨에서 주간 획득 절대 경험치 */
function weeklyExpAt(level, data, s) {
  const w = s.weekly
  let sum = 0
  if (w.epic.on) {
    const d = data.epicDungeon.dungeons.find((x) => x.id === w.epic.dungeon)
    if (d && level >= d.minLevel) {
      sum += byLevel(d.base, level) * data.epicDungeon.stages[w.epic.stage]
    }
  }
  if (w.park.on) {
    sum += parkWeeklyExp(parkZoneAt(level, data, w.park.zone), w.park.runs || 0, w.park.sundaySpecial)
  }
  if (w.extreme.on && level >= data.extremePark.minLevel) {
    sum += byLevel(data.extremePark.byLevel, level)
  }
  sum += byLevel(data.sauna.hourly, level) * (w.mvpHours || 0)
  return sum
}

/** 일회성 아이템 절대 경험치 (레벨 점프류 제외) */
function itemsExpAt(level, data, s) {
  const it = s.items
  let sum = 0
  sum += byLevel(data.coupons.normal.byLevel, level) * (it.couponNormal || 0)
  if (level >= (data.coupons.upper.minLevel || 0)) {
    sum += byLevel(data.coupons.upper.byLevel, level) * (it.couponUpper || 0)
  }
  sum += byLevel(data.sauna.hourly, level) * 0.5 * (it.vipTickets || 0)
  const f = data.farms
  if (level >= f.golden.minLevel && level <= f.golden.maxLevel) sum += byLevel(f.golden.byLevel, level) * (it.farmGolden || 0)
  if (level >= f.blue.minLevel) sum += byLevel(f.blue.byLevel, level) * (it.farmBlue || 0)
  if (level >= f.mech.minLevel) sum += byLevel(f.mech.byLevel, level) * (it.farmMech || 0)
  return sum
}

const MAX_LEVEL = 300
const lvExp = (data, L) => data.levelExp[String(L)] || Infinity

/**
 * 시뮬레이션 본체.
 * @returns {days, reachedLevel, reachedPct, breakdown}
 * targetLevel 모드: 도달까지 일수 (도달 불가면 days=null)
 * days 모드(targetDays): 해당 일수 후 레벨/경험치
 */
export function simulate(data, char, s, { targetLevel = null, targetDays = null }) {
  let L = char.character_level
  let exp = (char.exp_rate / 100) * lvExp(data, L)
  const huntAbs = ((s.hunt.pctPerRun || 0) / 100) * lvExp(data, L) * (s.hunt.runsPerDay || 0)

  const levelUp = () => {
    while (L < MAX_LEVEL && exp >= lvExp(data, L)) {
      exp -= lvExp(data, L)
      L += 1
    }
  }

  // ── 일회성: 시작 시점에 적용 ──
  // 달성의 비약: 목표 레벨 미만이면 그 레벨로 점프, 이상이면 고정 경험치
  for (const le of data.levelElixirs) {
    const count = le.id === 'e200lv' ? s.items.e200lv || 0 : s.items.e250lv || 0
    for (let i = 0; i < count; i++) {
      if (L < le.targetLevel) { L = le.targetLevel; exp = 0 } else { exp += le.exp; levelUp() }
    }
  }
  // 성장의 비약: 캡 미만이면 1레벨 상승, 이상이면 고정 경험치 (캡 낮은 것부터 사용)
  for (const elixir of data.elixirs) {
    const count = s.items.elixirCounts?.[elixir.id] || 0
    for (let i = 0; i < count; i++) {
      if (L < elixir.capLevel) { L += 1; exp = 0 } else { exp += elixir.exp; levelUp() }
    }
  }
  exp += itemsExpAt(L, data, s)
  levelUp()

  // ── 하루 단위 진행 ──
  const limitDays = targetDays ?? 3650
  let day = 0
  while (day < limitDays) {
    if (targetLevel != null && L >= targetLevel) break
    if (L >= MAX_LEVEL) break
    exp += dailyExpAt(L, huntAbs, data, s) + weeklyExpAt(L, data, s) / 7
    levelUp()
    day += 1
  }

  const reached = targetLevel != null && L >= targetLevel
  return {
    days: targetLevel != null ? (reached ? day : null) : day,
    reachedLevel: L,
    reachedPct: L >= MAX_LEVEL ? 0 : (exp / lvExp(data, L)) * 100,
  }
}

/** 화면 표시용: 현재 레벨 기준 컨텐츠별 기여도(%). */
export function breakdown(data, char, s) {
  const L = char.character_level
  const E = lvExp(data, L)
  const pct = (abs) => (abs / E) * 100
  const huntAbs = ((s.hunt.pctPerRun || 0) / 100) * E * (s.hunt.runsPerDay || 0)

  const zones = {}
  let dailyQuest = 0
  for (const group of ['arcane', 'tenebris', 'grandis']) {
    let g = 0
    for (const z of data.daily[group]) {
      const locked = L < z.minLevel
      const on = !locked && zoneOn(s.daily, z.id)
      const p = pct(z.exp)
      zones[z.id] = { locked, on, pct: p }
      if (on) g += p
    }
    zones[`${group}Total`] = g
    dailyQuest += g
  }

  const w = s.weekly
  const epicDungeon = data.epicDungeon.dungeons.find((x) => x.id === w.epic.dungeon)
  const epicLocked = !epicDungeon || L < epicDungeon.minLevel
  const epicOne = epicLocked ? 0 : byLevel(epicDungeon.base, L) * data.epicDungeon.stages[w.epic.stage]
  const epic = w.epic.on && !epicLocked ? epicOne : 0

  const parkZone = parkZoneAt(L, data, w.park.zone)
  // 몬파는 매일 도는 컨텐츠지만 일요일 보너스 때문에 주 단위로 계산한다.
  // 집계·표시는 하루치가 맞으므로 7로 나눠 평균을 낸다.
  const parkWeek = w.park.on ? parkWeeklyExp(parkZone, w.park.runs || 0, w.park.sundaySpecial) : 0

  const extremeLocked = L < data.extremePark.minLevel
  const extremeOne = extremeLocked ? 0 : byLevel(data.extremePark.byLevel, L)
  const extreme = w.extreme.on && !extremeLocked ? extremeOne : 0
  const saunaHour = byLevel(data.sauna.hourly, L)
  const mvp = saunaHour * (w.mvpHours || 0)

  const it = s.items
  // 캡 미만이면 1레벨 상승이라 "현재 레벨 1레벨치"로 환산 표시
  const elixirEach = {}
  const elixirOne = {} // 1개당 획득 (%)
  let elixirPct = 0
  for (const e of data.elixirs) {
    const one = L < e.capLevel ? E : e.exp
    const p = pct(one * (it.elixirCounts?.[e.id] || 0))
    elixirEach[e.id] = p
    elixirOne[e.id] = pct(one)
    elixirPct += p
  }
  const e200 = it.e200lv && L >= 200 ? pct(data.levelElixirs[0].exp * it.e200lv) : 0
  const e250 = it.e250lv && L >= 250 ? pct(data.levelElixirs[1].exp * it.e250lv) : 0
  const e200One = pct(data.levelElixirs[0].exp)
  const e250One = pct(data.levelElixirs[1].exp)
  const couponNOne = pct(byLevel(data.coupons.normal.byLevel, L))
  const couponUOne = L >= (data.coupons.upper.minLevel || 0) ? pct(byLevel(data.coupons.upper.byLevel, L)) : 0
  const couponN = couponNOne * (it.couponNormal || 0)
  const couponU = couponUOne * (it.couponUpper || 0)
  const vipOne = pct(saunaHour * 0.5) // 이용권 1개 = 30분
  const vip = vipOne * (it.vipTickets || 0)
  const f = data.farms
  const goldenLocked = L > f.golden.maxLevel
  const goldenOne = !goldenLocked && L >= f.golden.minLevel ? pct(byLevel(f.golden.byLevel, L)) : 0
  const golden = goldenOne * (it.farmGolden || 0)
  const blueLocked = L < f.blue.minLevel
  const blueOne = !blueLocked ? pct(byLevel(f.blue.byLevel, L)) : 0
  const blue = blueOne * (it.farmBlue || 0)
  const mechLocked = L < f.mech.minLevel
  const mechOne = !mechLocked ? pct(byLevel(f.mech.byLevel, L)) : 0
  const mech = mechOne * (it.farmMech || 0)

  const hunt = pct(huntAbs)
  const parkDaily = pct(parkWeek) / 7
  const dailyTotal = hunt + dailyQuest + parkDaily
  const weeklyTotal = pct(epic + extreme + mvp)
  const onceTotal = elixirPct + e200 + e250 + couponN + couponU + vip + golden + blue + mech

  return {
    E,
    hunt,
    zones,
    dailyQuest,
    dailyTotal,
    epic: { locked: epicLocked, one: pct(epicOne), total: pct(epic) },
    park: {
      zone: parkZone,
      oneNormal: parkZone ? pct(parkZone.exp.normal) : 0,
      oneSunday: parkZone ? pct(w.park.sundaySpecial ? parkZone.exp.special : parkZone.exp.sunday) : 0,
      total: parkDaily,   // 하루 평균 (카드 합계·일일 집계 공통)
      week: pct(parkWeek),
    },
    extreme: { locked: extremeLocked, one: pct(extremeOne), total: pct(extreme) },
    mvp: pct(mvp),
    saunaHourPct: pct(saunaHour), // 잠수 1시간당 획득 (사우나·리조트 공통)
    weeklyTotal,
    elixir: elixirPct,
    elixirEach,
    elixirOne,
    e200, e250, e200One, e250One, couponN, couponU, couponNOne, couponUOne, vip, vipOne,
    golden: { locked: goldenLocked, one: goldenOne, total: golden },
    blue: { locked: blueLocked, one: blueOne, total: blue },
    mech: { locked: mechLocked, one: mechOne, total: mech },
    onceTotal,
  }
}

export function fmtPct(p) {
  if (!p) return '—'
  if (p >= 10) return `${p.toFixed(2)}%`
  if (p >= 0.01) return `${p.toFixed(4)}%`
  return `${p.toFixed(4)}%`
}

/** 조 단위 축약 (남은 경험치 표시용) */
export function fmtTrillion(abs) {
  if (abs >= 1e12) return `${(abs / 1e12).toFixed(1)}조`
  if (abs >= 1e8) return `${(abs / 1e8).toFixed(0)}억`
  return abs.toLocaleString()
}

export function remainingToLevel(data, char, targetLevel) {
  let sum = -((char.exp_rate / 100) * lvExp(data, char.character_level))
  for (let L = char.character_level; L < targetLevel; L++) sum += lvExp(data, L)
  return Math.max(0, sum)
}
