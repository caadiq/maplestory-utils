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
 * 몬파 하루치 획득(절대값) — 평일/일요일 각각.
 *
 * 데이터의 exp는 '기본 대비 총 배수'다: normal=100%, sunday=150%, special=400%
 * (평일 100% + 일요일 50% + 스페셜 썬데이 250%).
 *
 * 보약(몬파 +N%)은 이 배수에 **곱하는 게 아니라 더한다**.
 * 예: 보약 +100%인 캐릭터의 일요일은 150%×200%(=300%)가 아니라 150%+100%(=250%)다.
 * 실측 대조(Lv.288 카르시온 7회, 몬파 +100%):
 *   평일 1.6491% / 일요일 2.0615% / 스페셜 4.1230% ← 더하는 쪽과 일치.
 * (평일은 이벤트 증가가 없어 곱하든 더하든 같아서 평일 실측으로는 드러나지 않았다)
 *
 * @param bPark 보약 배수 (1 = 보너스 없음)
 */
export function parkDayExp(zone, runsPerDay, { special = false, sunday = false, bPark = 1 } = {}) {
  if (!zone || !runsPerDay) return 0
  const base = sunday ? (special ? zone.exp.special : zone.exp.sunday) : zone.exp.normal
  return runsPerDay * (base + zone.exp.normal * (bPark - 1))
}

/** 몬파 주간 획득 — 평일 6일 + 일요일 1일 */
export function parkWeeklyExp(zone, runsPerDay, special = false, bPark = 1) {
  return parkDayExp(zone, runsPerDay, { bPark }) * 6
    + parkDayExp(zone, runsPerDay, { sunday: true, special, bPark })
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
    /*
     * 설정 판 버전. 2부터는 일퀘 지역·익몬·에픽이 **기본 꺼짐**이다 — 새로 넣은 캐릭터가
     * 하지도 않는 컨텐츠를 다 켜 둔 채 시작하면 안 된다(Lv.212가 익몬을 켜고 있었다).
     * 예전 판(v 없음)은 지역이 기본 켜짐이었고 그 저장본이 남아 있어, zoneOn이 판을 보고 읽는다.
     */
    v: 2,
    hunt: { pctPerRun: 0, runsPerDay: 0 },
    daily: {}, // zoneId -> true 만 기록 (v2: 기본 꺼짐)
    weekly: {
      epic: { on: false, dungeon: 'auto', stage: 2 },
      park: { on: true, zone: 'auto', runs: 2, sundaySpecial: false },
      extreme: { on: false },
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

/**
 * 일퀘 지역이 켜져 있는지.
 * v2 설정은 명시적으로 켠 것만 켜짐. 예전 설정(v 없음)은 기본 켜짐이라 끈 것만 false —
 * 그때 저장한 캐릭터가 갑자기 다 꺼지면 안 되므로 판을 보고 갈라 읽는다.
 */
export const zoneOn = (s, id) => ((s?.v ?? 1) >= 2 ? s?.daily?.[id] === true : s?.daily?.[id] !== false)

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

/**
 * 에픽던전에서 실제 계산에 쓸 던전 (auto·입장 못 하는 선택 = 입장 가능한 최고 던전).
 * 몬파와 같은 규칙이다 — Lv.270이 악몽선경(280)을 고르고 있으면 앵글러 컴퍼니로 본다.
 * 하나도 못 들어가면 null.
 */
export function epicAt(level, data, dungeonId) {
  const open = data.epicDungeon.dungeons.filter((d) => level >= d.minLevel)
  if (!open.length) return null
  if (dungeonId && dungeonId !== 'auto') {
    const d = open.find((x) => x.id === dungeonId)
    if (d) return d
  }
  return open[open.length - 1]
}

const MAX_LEVEL = 300
const lvExp = (data, L) => data.levelExp[String(L)] || Infinity

/**
 * 레벨을 넘나들며 경험치를 쌓는다.
 *
 * "이 레벨 필요량의 몇 배"(abs / E)로만 환산하면 100%를 넘는 순간 거짓말이 된다 —
 * 렙업하면 필요량이 늘고, 레벨별 테이블(사우나·농장·교환권·에픽·익몬)의 값도 바뀐다.
 * 실측: Lv.212 리조트 18시간은 환산으로 2021%지만 실제로는 13레벨(Lv.225 56.8%)이다.
 *
 * chunk 하나는 절대값이거나 `(레벨, 그 레벨 안의 경험치) => 절대값` — 레벨 테이블 항목은 함수로 준다.
 *
 * @param startRate 출발 레벨 안의 % (캐릭터의 현재 경험치)
 * @returns {{ pct: number, level: number, rate: number, levels: number }}
 *   pct    출발점에서 얼마나 갔나 — 레벨당 100%. 렙업이 없으면 예전 환산과 정확히 같다.
 *   level  도착 레벨 / rate 그 레벨 안의 % / levels 오른 레벨 수
 */
export function walk(data, level, startRate, chunks) {
  const r0 = Math.min(Math.max(startRate || 0, 0), 99.9999)
  let L = level
  const need0 = lvExp(data, L)
  let e = Number.isFinite(need0) ? (r0 / 100) * need0 : 0
  for (const c of chunks) {
    e += typeof c === 'function' ? c(L, e) : c
    while (L < MAX_LEVEL && e >= lvExp(data, L)) { e -= lvExp(data, L); L += 1 }
  }
  const need = lvExp(data, L)
  const rate = Number.isFinite(need) ? (e / need) * 100 : 0
  return { pct: (L - level) * 100 + rate - r0, level: L, rate, levels: L - level }
}

/**
 * 화면 표시용 — 선택한 레벨 기준으로 "1개(1회)당 몇 %"와 "개수만큼 하면 몇 %".
 *
 * 예전에는 캐릭터 레벨로만 계산했지만, 지금은 레벨을 직접 고를 수 있어야 해서
 * 레벨을 그대로 받는다.
 *
 * bonus(보약·아티팩트)는 캐릭터를 골랐을 때만 들어온다 — 보약은 서버·캐릭터마다
 * 찍은 단계가 달라 레벨만으로는 정할 수 없다. 없으면 순수 기본값이 나온다.
 *
 * 단가("1개당"·"1시간당")는 이 레벨 기준 환산(pct)이고, **합계는 전부 걸어서 잰다**(walk) —
 * startRate(캐릭터 현재 경험치)에서 출발해 실제로 어디까지 가는지. 렙업이 없으면 둘은 같다.
 * 합계마다 도착점을 reach에 같이 준다.
 */
export function breakdown(data, level, s, bonus, startRate = 0) {
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
  const go = (chunks) => walk(data, L, startRate, chunks)
  const rep = (n, c) => new Array(Math.max(0, Math.floor(n) || 0)).fill(c)
  const reach = {}

  /* ── 일퀘 (지역값은 레벨 무관 고정) ── */
  const zones = {}
  const dailyAbs = {}
  for (const group of ['arcane', 'tenebris', 'grandis']) {
    let abs = 0
    for (const z of data.daily[group]) {
      const locked = L < z.minLevel
      const on = !locked && zoneOn(s, z.id)
      const a = z.exp * bDaily[group]
      zones[z.id] = { locked, on, pct: pct(a) }
      if (on) abs += a
    }
    dailyAbs[group] = abs
    const g = go([abs])
    zones[`${group}Total`] = g.pct
    reach[`${group}Total`] = g
  }
  const dailyDayAbs = dailyAbs.arcane + dailyAbs.tenebris + dailyAbs.grandis
  /** 화면에서 그룹을 묶어 보여줄 때(아케인+테네브리스) — 합친 하루치를 한 번에 걷는다 */
  const daily = { of: (keys) => go([keys.reduce((sum, k) => sum + (dailyAbs[k] || 0), 0)]) }

  /* ── 주간 컨텐츠 ── */
  const w = s.weekly
  const epicDungeon = epicAt(L, data, w.epic.dungeon)
  const epicLocked = !epicDungeon
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
  const epicAbs = (l) => byLevel(epicDungeon.base, l) * (bEpic + epicExtra)
  const epicOne = epicLocked ? 0 : epicAbs(L)
  const epicOn = !!w.epic.on && !epicLocked
  const gEpic = go(epicOn ? [epicAbs] : [])

  const parkZone = parkZoneAt(L, data, w.park.zone)
  // 몬파는 매일 도는 컨텐츠지만 일요일 보너스 때문에 주 단위로 합산한다
  const parkRuns = w.park.on ? (w.park.runs || 0) : 0
  const parkDayN = parkDayExp(parkZone, parkRuns, { bPark })
  const parkDayS = parkDayExp(parkZone, parkRuns, { sunday: true, special: w.park.sundaySpecial, bPark })
  const gParkN = go([parkDayN])
  const gParkS = go([parkDayS])
  const gParkW = go([...rep(6, parkDayN), parkDayS])

  const extremeLocked = L < data.extremePark.minLevel
  /*
   * 익스트림 몬스터파크도 몬파 보너스("몬스터파크 퇴장 시 획득하는 경험치 N% 증가")를 받는다.
   * 에픽던전과 달리 보상 전체에 붙는다 — 288·몬파 +100% 기준 0.8120% → 1.6240%.
   */
  const extremeAbs = (l) => byLevel(data.extremePark.byLevel, l) * bPark
  const extremeOne = extremeLocked ? 0 : extremeAbs(L)
  const extremeOn = !!w.extreme.on && !extremeLocked
  const gExtreme = go(extremeOn ? [extremeAbs] : [])

  /* ── 잠수 ── */
  const saunaAbs = (l) => byLevel(data.sauna.hourly, l)
  const saunaHour = saunaAbs(L)
  // 분 단위로 걷는다 — 시간 단위면 렙업 시점의 오차가 한 시간치까지 벌어진다
  const mvpChunks = rep(Math.round((w.mvpHours || 0) * 60), (l) => saunaAbs(l) / 60)
  const it = s.items
  const vipChunks = rep(it.vipTickets || 0, (l) => saunaAbs(l) * 0.5)   // 이용권 1개 = 30분
  const gMvp = go(mvpChunks)
  const gVip = go(vipChunks)
  const gDiving = go([...mvpChunks, ...vipChunks])

  /* ── 아이템 ── */
  /*
   * 성장의 비약은 캡 미만이면 "1레벨 상승" — 경험치 %는 그대로 두고 레벨만 하나 올린다.
   * 그래서 chunk가 현재 경험치(e)까지 받아, 다음 레벨에서 같은 %가 되는 만큼을 준다.
   * 캡 이상이면 고정 절대값이다.
   */
  const elixirEach = {}
  const elixirOne = {} // 1개당 획득 (%)
  const elixirChunks = []
  for (const e of data.elixirs) {
    const one = (l, cur) => {
      if (l >= e.capLevel) return e.exp
      const now = lvExp(data, l)
      const next = lvExp(data, l + 1)
      return Number.isFinite(next) ? now - cur + (cur * next) / now : now - cur
    }
    const chunks = rep(it.elixirCounts?.[e.id] || 0, one)
    elixirEach[e.id] = go(chunks).pct
    elixirOne[e.id] = pct(L < e.capLevel ? E : e.exp)
    elixirChunks.push(...chunks)
  }
  const e250Locked = L < 250
  const e200Chunks = rep(L >= 200 ? it.e200lv || 0 : 0, data.levelElixirs[0].exp)
  const e250Chunks = rep(e250Locked ? 0 : it.e250lv || 0, data.levelElixirs[1].exp)
  const e200 = go(e200Chunks).pct
  const e250 = go(e250Chunks).pct
  const e200One = pct(data.levelElixirs[0].exp)
  const e250One = e250Locked ? 0 : pct(data.levelElixirs[1].exp)
  const gElixir = go([...elixirChunks, ...e200Chunks, ...e250Chunks])

  const couponULocked = L < (data.coupons.upper.minLevel || 0)
  const couponNAbs = (l) => byLevel(data.coupons.normal.byLevel, l)
  const couponUAbs = (l) => (l >= (data.coupons.upper.minLevel || 0) ? byLevel(data.coupons.upper.byLevel, l) : 0)
  const couponNOne = pct(couponNAbs(L))
  const couponUOne = couponULocked ? 0 : pct(couponUAbs(L))
  const couponNChunks = rep(it.couponNormal || 0, couponNAbs)
  const couponUChunks = rep(couponULocked ? 0 : it.couponUpper || 0, couponUAbs)
  const couponN = go(couponNChunks).pct
  const couponU = go(couponUChunks).pct
  const gCoupon = go([...couponNChunks, ...couponUChunks])

  /*
   * 농장 — 입장 조건을 걷는 중에도 본다. 황금 딸기는 259까지라 걷다가 넘기면 그 뒤 입장권은 0이다.
   * 크림슨 메카베리는 기존과 같은 구조인데 경험치 가중치가 전 구간 154 고정.
   * 테이블은 기존 × 154/가중치(99·132·143)로 산출(테스트월드 1.2.205 기준).
   * 본섭 실측으로 확인됨(Lv.288): 1회에 48.667% → 53.374%, 즉 4.707% — 표의 4.7076%와 일치.
   */
  const f = data.farms
  const farm = (spec, count) => {
    if (!spec) return { locked: true, one: 0, total: 0, chunks: [] }
    const can = (l) => l >= spec.minLevel && (spec.maxLevel == null || l <= spec.maxLevel)
    const abs = (l) => (can(l) ? byLevel(spec.byLevel, l) : 0)
    const locked = !can(L)
    const chunks = rep(locked ? 0 : count || 0, abs)
    return { locked, one: locked ? 0 : pct(abs(L)), total: go(chunks).pct, chunks }
  }
  const golden = farm(f.golden, it.farmGolden)
  const blue = farm(f.blue, it.farmBlue)
  const mech = farm(f.mech, it.farmMech)
  const crimson = farm(f.crimson, it.farmCrimson)
  const farmChunks = [...golden.chunks, ...blue.chunks, ...mech.chunks, ...crimson.chunks]
  const gFarm = go(farmChunks)
  const strip = (o) => ({ locked: o.locked, one: o.one, total: o.total })

  /*
   * 분류는 시간 기준으로 나눈다 — 섞으면 더할 수 없다.
   *   주간   : 일퀘(7일치)·몬파(일요일 보너스 포함 한 주)·익스몬파·에픽던전
   *   잠수   : 리조트·사우나 (입력한 시간·개수만큼)
   *   아이템 : 비약·교환권·농장 (쓰면 없어지는 것)
   * 몬파는 일요일 보너스가 주 1회뿐이라 하루 기준으로 정확히 못 쪼갠다 — 주 단위가 맞다.
   * 주간은 하루씩(일퀘+몬파) 6일과 일요일을 걷고 나서 익몬·에픽을 얹는다.
   */
  const gWeekly = go([
    ...rep(6, dailyDayAbs + parkDayN),
    dailyDayAbs + parkDayS,
    ...(extremeOn ? [extremeAbs] : []),
    ...(epicOn ? [epicAbs] : []),
  ])
  const gOnce = go([...elixirChunks, ...e200Chunks, ...e250Chunks, ...couponNChunks, ...couponUChunks, ...farmChunks])

  Object.assign(reach, {
    epic: gEpic,
    extreme: gExtreme,
    parkNormal: gParkN,
    parkSunday: gParkS,
    mvp: gMvp,
    vip: gVip,
    diving: gDiving,
    elixir: gElixir,
    coupon: gCoupon,
    farm: gFarm,
    weekly: gWeekly,
    once: gOnce,
  })

  return {
    E,
    zones,
    daily,
    dailyQuest: go([dailyDayAbs]).pct,
    epic: {
      locked: epicLocked,
      dungeon: epicDungeon,
      minLevel: data.epicDungeon.dungeons[0]?.minLevel,
      one: pct(epicOne),
      total: gEpic.pct,
    },
    park: {
      zone: parkZone,
      /*
       * 하루치를 평일과 일요일로 나눠서 준다.
       * 일요일만 경험치가 다르기 때문에 '일 평균'으로는 실제 하루 획득량과 맞는 날이 하루도 없다.
       */
      dayNormal: gParkN.pct,
      daySunday: gParkS.pct,
      week: gParkW.pct,
    },
    extreme: { locked: extremeLocked, one: pct(extremeOne), total: gExtreme.pct },
    mvp: gMvp.pct,
    vip: gVip.pct,
    vipOne: pct(saunaHour * 0.5),
    saunaHourPct: pct(saunaHour), // 잠수 1시간당 획득 (사우나·리조트 공통)
    divingTotal: gDiving.pct,
    weeklyTotal: gWeekly.pct,
    elixirEach,
    elixirOne,
    elixirTotal: gElixir.pct,
    e200, e250, e200One, e250One, e250Locked,
    couponN, couponU, couponNOne, couponUOne, couponULocked,
    couponTotal: gCoupon.pct,
    golden: strip(golden),
    blue: strip(blue),
    mech: strip(mech),
    crimson: strip(crimson),
    farmTotal: gFarm.pct,
    onceTotal: gOnce.pct,
    reach,
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
