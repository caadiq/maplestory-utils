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
      farmCrimson: 0,
    },
    goal: { level: Math.min(level + 1 || 261, 300) },
  }
}

/** 일퀘 지역이 켜져 있는지 (기본 켜짐, 명시적으로 끈 것만 false) */
export const zoneOn = (daily, id) => daily?.[id] !== false

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

const MAX_LEVEL = 300
const lvExp = (data, L) => data.levelExp[String(L)] || Infinity

/**
 * 화면 표시용 — 선택한 레벨 기준으로 "1개(1회)당 몇 %"와 "개수만큼 하면 몇 %".
 *
 * 예전에는 캐릭터 레벨로만 계산했지만, 지금은 레벨을 직접 고를 수 있어야 해서
 * 레벨을 그대로 받는다.
 *
 * bonus(보약·아티팩트)는 캐릭터를 골랐을 때만 들어온다 — 보약은 서버·캐릭터마다
 * 찍은 단계가 달라 레벨만으로는 정할 수 없다. 없으면 순수 기본값이 나온다.
 */
export function breakdown(data, level, s, bonus) {
  const L = level
  const E = lvExp(data, L)
  const bo = bonus || {}
  const bMul = (pct) => 1 + (pct || 0) / 100
  /*
   * 테네브리스(문브릿지·고통의 미궁·리멘)도 아케인리버 일퀘 보너스를 받는다.
   * 실측(Lv.288, 아케인 일퀘 +50%): 세 지역을 다 돌아 인게임 +0.031%.
   * 보너스 없이는 0.0209%, +50%면 0.0313% — 뒤쪽이 맞다.
   * MVP 퀵패스로 완료해서 사냥 경험치가 섞이지 않은 값이다.
   */
  const bArcane = bMul(bo.arcaneDaily)
  const bDaily = { arcane: bArcane, tenebris: bArcane, grandis: bMul(bo.grandisDaily) }
  const bPark = bMul(bo.monsterPark)
  const bEpic = bMul(bo.epicDungeon)
  const pct = (abs) => (abs / E) * 100

  const zones = {}
  let dailyQuest = 0
  for (const group of ['arcane', 'tenebris', 'grandis']) {
    let g = 0
    for (const z of data.daily[group]) {
      const locked = L < z.minLevel
      const on = !locked && zoneOn(s.daily, z.id)
      const p = pct(z.exp * bDaily[group])
      zones[z.id] = { locked, on, pct: p }
      if (on) g += p
    }
    zones[`${group}Total`] = g
    dailyQuest += g
  }

  const w = s.weekly
  const epicDungeon = data.epicDungeon.dungeons.find((x) => x.id === w.epic.dungeon)
  const epicLocked = !epicDungeon || L < epicDungeon.minLevel
  /*
   * 에픽던전 보상 = 기본 보상 + 추가 배수 보상.
   * 보약의 "에픽 던전 **기본** 경험치 보상 획득량 N% 증가"는 말 그대로 기본 보상에만 붙는다
   * — 추가 배수 보상은 보너스를 안 받는다.
   *
   * 실측(Lv.288, 에픽 +200%, 악몽선경): 4배 보상을 받은 상태에서 8배로 올리면
   * 47.098% → 50.950%로 3.852% 증가. 기본 보상 1배가 0.9629%이므로 정확히 4배분이다.
   * (전체에 보너스가 붙는다면 4배분 × 3 = 11.55%가 올라야 했다)
   *
   * data의 stages는 '기본 포함 총 배수'(1·5·9)라 추가분은 거기서 1을 뺀 값이다.
   */
  const epicExtra = data.epicDungeon.stages[w.epic.stage] - 1
  const epicOne = epicLocked ? 0 : byLevel(epicDungeon.base, L) * (bEpic + epicExtra)
  const epic = w.epic.on && !epicLocked ? epicOne : 0

  const parkZone = parkZoneAt(L, data, w.park.zone)
  // 몬파는 매일 도는 컨텐츠지만 일요일 보너스 때문에 주 단위로 합산한다
  const parkRuns = w.park.on ? (w.park.runs || 0) : 0
  const parkWeek = parkWeeklyExp(parkZone, parkRuns, w.park.sundaySpecial) * bPark

  const extremeLocked = L < data.extremePark.minLevel
  /*
   * 익스트림 몬스터파크도 몬파 보너스("몬스터파크 퇴장 시 획득하는 경험치 N% 증가")를 받는다.
   * 에픽던전과 달리 보상 전체에 붙는다 — 288·몬파 +100% 기준 0.8120% → 1.6240%.
   */
  const extremeOne = extremeLocked ? 0 : byLevel(data.extremePark.byLevel, L) * bPark
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
  /*
   * 크림슨 메카베리 — 기존과 같은 구조인데 경험치 가중치가 전 구간 154 고정.
   * 테이블은 기존 × 154/가중치(99·132·143)로 산출(테스트월드 1.2.205 기준).
   * 본섭 실측으로 확인됨(Lv.288): 1회에 48.667% → 53.374%, 즉 4.707% — 표의 4.7076%와 일치.
   */
  const crimsonLocked = !f.crimson || L < f.crimson.minLevel
  const crimsonOne = !crimsonLocked ? pct(byLevel(f.crimson.byLevel, L)) : 0
  const crimson = crimsonOne * (it.farmCrimson || 0)

  /*
   * 분류는 시간 기준으로 나눈다 — 섞으면 더할 수 없다.
   *   주간   : 일퀘(7일치)·몬파(일요일 보너스 포함 한 주)·익스몬파·에픽던전
   *   잠수   : 리조트·사우나 (입력한 시간·개수만큼)
   *   아이템 : 비약·교환권·농장 (쓰면 없어지는 것)
   * 몬파는 일요일 보너스가 주 1회뿐이라 하루 기준으로 정확히 못 쪼갠다 — 주 단위가 맞다.
   */
  // 일퀘·몬파는 카드에서 하루 기준으로 보여주고, 요약에서만 한 주로 환산해 더한다
  const weeklyTotal = dailyQuest * 7 + pct(parkWeek + epic + extreme)
  const divingTotal = pct(mvp) + vip
  const onceTotal = elixirPct + e200 + e250 + couponN + couponU + golden + blue + mech + crimson

  return {
    E,
    zones,
    dailyQuest,
    epic: { locked: epicLocked, one: pct(epicOne), total: pct(epic) },
    park: {
      zone: parkZone,
      /*
       * 하루치를 평일과 일요일로 나눠서 준다.
       * 일요일만 경험치가 다르기 때문에 '일 평균'으로는 실제 하루 획득량과 맞는 날이 하루도 없다.
       */
      dayNormal: parkZone ? pct(parkZone.exp.normal * bPark) * parkRuns : 0,
      daySunday: parkZone ? pct((w.park.sundaySpecial ? parkZone.exp.special : parkZone.exp.sunday) * bPark) * parkRuns : 0,
      week: pct(parkWeek),
    },
    extreme: { locked: extremeLocked, one: pct(extremeOne), total: pct(extreme) },
    mvp: pct(mvp),
    saunaHourPct: pct(saunaHour), // 잠수 1시간당 획득 (사우나·리조트 공통)
    weeklyTotal,
    divingTotal,
    elixir: elixirPct,
    elixirEach,
    elixirOne,
    e200, e250, e200One, e250One, couponN, couponU, couponNOne, couponUOne, vip, vipOne,
    golden: { locked: goldenLocked, one: goldenOne, total: golden },
    blue: { locked: blueLocked, one: blueOne, total: blue },
    mech: { locked: mechLocked, one: mechOne, total: mech },
    crimson: { locked: crimsonLocked, one: crimsonOne, total: crimson },
    onceTotal,
  }
}

/**
 * 자릿수는 크기에 맞춰 잡되, 뒤에 남는 0은 지운다 — 0.4300%는 0.43%로 충분하다.
 * (0.5000%처럼 소수부가 전부 0이면 점까지 지워 '0.5%'가 아니라 정수로 떨어진다)
 */
export function fmtPct(p) {
  if (!p) return '—'
  const fixed = p >= 10 ? p.toFixed(2) : p.toFixed(4)
  return `${fixed.replace(/\.?0+$/, '')}%`
}
