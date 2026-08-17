/**
 * 경험치 계산 — "지금 이걸 몇 개 쓰면 얼마나 오르나"만 본다.
 *
 * 예전 버전은 하루 획득량으로 목표 레벨 도달일까지 예측했는데, 일회성 아이템을
 * 언제 쓸지 모른다는 문제(메카베리는 쓰는 레벨에 따라 개당 가치가 2.5배 벌어진다)로
 * 접었다. 지금은 예측을 하지 않고 **선택한 레벨 기준의 현재 값**만 계산한다.
 *
 * 데이터(/api/exp/data)는 전부 게임 원본 정수다:
 * - 지역 일퀘·몬파·주간퀘: 레벨 무관 고정 절대값
 * - 에픽던전·익스몬파·사우나·농장·교환권: 레벨별 절대값 테이블
 * - 성장의 비약: 캡 레벨의 1레벨 경험치와 정확히 일치
 *
 * 보너스(보약·아티팩트)는 캐릭터마다 다르므로 계산에 넣을지는 호출부가 정한다 —
 * 캐릭터를 고르면 반영하고, 레벨만 입력해서 볼 때는 기본값 그대로 본다.
 */

/** 레벨별 필요 경험치 (테이블 밖이면 null) */
export const levelExp = (data, level) => data?.levelExp?.[String(level)] ?? null

/** 레벨별 표에서 값 꺼내기 — 표 범위를 넘으면 마지막 값을 유지한다 */
export function byLevel(table, level) {
  if (!table) return 0
  const v = table[String(level)]
  if (v != null) return v
  const keys = Object.keys(table)
  if (!keys.length) return 0
  const max = keys[keys.length - 1]
  return level > Number(max) ? table[max] : 0
}

/** 보너스 배수 (100% → 2배). 보너스를 안 쓰면 1 */
const mult = (pct) => 1 + (pct || 0) / 100

/*
 * 아이콘 슬러그 매핑 — 데이터의 지역 id와 이미지 이름이 서로 다르다.
 * 몬파 지역은 대부분 일퀘 심볼과 id가 같고 셀라스만 몬파 전용이다.
 */
const ZONE_ICON_PREFIX = {
  yeoro: 'arc', chewchew: 'arc', lacheln: 'arc', arcana: 'arc', morass: 'arc', esfera: 'arc',
  moonbridge: 'ten', maze: 'ten', limen: 'ten', sellas: 'mp',
  cernium: 'gra', arcs: 'gra', odium: 'gra', dowonkyung: 'gra', arteria: 'gra', carcion: 'gra', tallahart: 'gra',
}
const zoneIcon = (icons, id) => icons?.[`${ZONE_ICON_PREFIX[id]}_${id}`]
const EPIC_ICON = { high_mountain: 'ed_highmountain', angler_company: 'ed_angler', nightmare_paradise: 'ed_nightmare' }

export const EPIC_STAGES = [
  { value: 0, label: '기본' },
  { value: 1, label: '1단계' },
  { value: 2, label: '2단계' },
]

/**
 * 항목 목록을 만든다. 각 항목은 { key, group, name, icon, unit, each, bonusPct }.
 * each = 1회(1개)당 절대 경험치 — 보너스까지 반영된 값.
 *
 * bonus가 null이면 보너스를 반영하지 않는다(레벨만 입력한 경우).
 */
export function buildItems(data, level, bonus, opts = {}) {
  if (!data) return []
  const b = bonus || {}
  const items = []
  const add = (o) => items.push(o)

  /* ── 일일 퀘스트 ── */
  const dailyBonus = {
    arcane: b.arcaneDaily || 0,
    tenebris: 0,        // 스킬 효과에 테네브리스 항목이 없다 — 보너스 대상이 아니다
    grandis: b.grandisDaily || 0,
  }
  for (const group of ['arcane', 'tenebris', 'grandis']) {
    for (const z of data.daily?.[group] || []) {
      add({
        key: `daily_${z.id}`,
        group: '일일 퀘스트',
        name: z.name,
        icon: zoneIcon(data.icons, z.id),
        unit: '회',
        locked: level < z.minLevel,
        minLevel: z.minLevel,
        bonusPct: dailyBonus[group],
        each: Math.round(z.exp * mult(dailyBonus[group])),
      })
    }
  }

  /* ── 몬스터파크 ── */
  const mpBonus = b.monsterPark || 0
  const zone = data.monsterPark?.zones?.filter((z) => level >= z.minLevel).slice(-1)[0]
  if (zone) {
    add({
      key: 'mp_normal',
      group: '몬스터파크',
      name: `${zone.name} · 평일`,
      icon: zoneIcon(data.icons, zone.id) || data.icons?.mp,
      unit: '회',
      bonusPct: mpBonus,
      each: Math.round(zone.exp.normal * mult(mpBonus)),
    })
    add({
      key: 'mp_sunday',
      group: '몬스터파크',
      name: `${zone.name} · 일요일`,
      icon: zoneIcon(data.icons, zone.id) || data.icons?.mp,
      unit: '회',
      bonusPct: mpBonus,
      each: Math.round(zone.exp.sunday * mult(mpBonus)),
    })
    add({
      key: 'mp_special',
      group: '몬스터파크',
      name: `${zone.name} · 스페셜 썬데이`,
      icon: zoneIcon(data.icons, zone.id) || data.icons?.mp,
      unit: '회',
      bonusPct: mpBonus,
      each: Math.round(zone.exp.special * mult(mpBonus)),
    })
  }
  if (data.extremePark && level >= data.extremePark.minLevel) {
    add({
      key: 'mp_extreme',
      group: '몬스터파크',
      name: '익스트림 몬스터파크',
      icon: data.icons?.mp_extreme,
      unit: '회',
      bonusPct: 0, // 스킬 효과의 '몬스터파크 퇴장' 문구는 일반 몬파 기준이라 넣지 않는다
      each: byLevel(data.extremePark.byLevel, level),
    })
  }

  /* ── 에픽 던전 ── */
  const edBonus = b.epicDungeon || 0
  const stageMul = data.epicDungeon?.stages?.[opts.epicStage ?? 2] ?? 1
  for (const d of data.epicDungeon?.dungeons || []) {
    add({
      key: `ed_${d.id}`,
      group: '에픽 던전',
      name: d.name,
      icon: data.icons?.[EPIC_ICON[d.id]],
      unit: '회',
      locked: level < d.minLevel,
      minLevel: d.minLevel,
      bonusPct: edBonus,
      each: Math.round(byLevel(d.base, level) * stageMul * mult(edBonus)),
    })
  }

  /* ── 잠수 ── */
  const saunaHour = byLevel(data.sauna?.hourly, level)
  add({ key: 'sauna', group: '잠수', name: 'MVP 리조트 · 1시간', icon: data.icons?.sauna, unit: '시간', bonusPct: 0, each: saunaHour })
  add({ key: 'sauna_vip', group: '잠수', name: 'VIP 사우나 이용권 (30분)', icon: data.icons?.sauna_vip, unit: '개', bonusPct: 0, each: Math.round(saunaHour * 0.5) })

  /* ── 아이템 ── */
  const f = data.farms || {}
  if (f.golden && level >= f.golden.minLevel && level <= f.golden.maxLevel) {
    add({ key: 'farm_gold', group: '아이템', name: '황금 딸기 농장', icon: data.icons?.farm_gold, unit: '개', bonusPct: 0, each: byLevel(f.golden.byLevel, level) })
  }
  if (f.blue && level >= f.blue.minLevel) {
    add({ key: 'farm_blue', group: '아이템', name: '블루베리 농장', icon: data.icons?.farm_blue, unit: '개', bonusPct: 0, each: byLevel(f.blue.byLevel, level) })
  }
  if (f.mech && level >= f.mech.minLevel) {
    add({ key: 'farm_mech', group: '아이템', name: '메카베리 농장', icon: data.icons?.farm_mech, unit: '개', bonusPct: 0, each: byLevel(f.mech.byLevel, level) })
  }
  if (data.coupons?.normal) {
    add({ key: 'coupon', group: '아이템', name: 'EXP 교환권', icon: data.icons?.coupon, unit: '개', bonusPct: 0, each: byLevel(data.coupons.normal.byLevel, level) })
  }
  if (data.coupons?.upper && level >= (data.coupons.upper.minLevel || 0)) {
    add({ key: 'coupon_up', group: '아이템', name: '상급 EXP 교환권', icon: data.icons?.coupon_up, unit: '개', bonusPct: 0, each: byLevel(data.coupons.upper.byLevel, level) })
  }

  /* ── 비약 ── */
  for (const e of data.elixirs || []) {
    // 캡 미만이면 그 레벨의 1레벨치를 통째로 준다 (레벨업 1회와 같다)
    const under = level < e.capLevel
    add({
      key: `elixir_${e.id}`,
      group: '비약',
      name: e.name,
      icon: data.icons?.[`elixir_${e.id}`] || data.icons?.elixir,
      unit: '개',
      bonusPct: 0,
      note: under ? '레벨업 1회' : null,
      each: under ? (levelExp(data, level) ?? 0) : e.exp,
    })
  }
  for (const e of data.levelElixirs || []) {
    add({
      key: `elixir_lv_${e.id}`,
      group: '비약',
      name: e.name,
      icon: data.icons?.[e.id === 'e200lv' ? 'elixir200' : 'elixir250'],
      unit: '개',
      bonusPct: 0,
      note: level < e.targetLevel ? `Lv.${e.targetLevel}로 즉시 상승` : null,
      each: level < e.targetLevel ? null : e.exp, // 레벨 점프는 경험치로 환산할 수 없다
    })
  }

  return items
}

/** 개수를 곱해 합계를 낸다 — { total, rows } */
export function summarize(items, counts, data, level) {
  const need = levelExp(data, level) || 0
  let total = 0
  const rows = []
  for (const it of items) {
    const n = counts?.[it.key] || 0
    if (!n || it.each == null || it.locked) continue
    const sum = it.each * n
    total += sum
    rows.push({ ...it, count: n, sum, pct: need ? (sum / need) * 100 : 0 })
  }
  return {
    total,
    rows,
    need,
    pct: need ? (total / need) * 100 : 0,
    /** 이 레벨 기준으로 몇 레벨을 올릴 수 있는지 (같은 레벨 필요치가 계속 든다고 가정) */
    levels: need ? total / need : 0,
  }
}

/** 큰 숫자를 조/억 단위로 — 경험치는 자릿수가 커서 그대로 두면 읽히지 않는다 */
export function formatExp(n) {
  if (!n) return '0'
  const jo = Math.floor(n / 1e12)
  const eok = Math.floor((n % 1e12) / 1e8)
  if (jo) return `${jo.toLocaleString()}조 ${eok.toLocaleString()}억`
  if (eok) return `${eok.toLocaleString()}억`
  return n.toLocaleString()
}

export function formatPct(p) {
  if (!p) return '0%'
  if (p >= 100) return `${p.toFixed(1)}%`
  if (p >= 1) return `${p.toFixed(2)}%`
  return `${p.toFixed(3)}%`
}
