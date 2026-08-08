import axios from 'axios';
import { Op } from 'sequelize';
import { EnchantHistoryCache } from '../models/index.js';
import { nexonGet as nexonRequest } from '../lib/nexon.js';

export const TYPES = {
  starforce: { path: 'starforce', listKey: 'starforce_history' },
  cube: { path: 'cube', listKey: 'cube_history' },
  potential: { path: 'potential', listKey: 'potential_history' },
};

const DAY_MS = 24 * 60 * 60 * 1000;
// 넥슨은 최근 약 2년(729일)치만 제공 — 그보다 과거는 400을 반환하므로 요청하지 않는다
const MAX_HISTORY_DAYS = 728;

// 넥슨 GET — 429 시 지수 백오프(lib/nexon). 이력 API를 여러 번 치므로 본문만 바로 반환한다.
const nexonGet = (path, params) => nexonRequest(path, params, { retry: 5 }).then((r) => r.data);

export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 조회 가능한 가장 이른 날짜 (오늘 - 728일) */
export function minDateKST() {
  return new Date(Date.now() + 9 * 3600 * 1000 - MAX_HISTORY_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/** 넥슨에서 하루치 이력 수집 (커서 페이징) */
async function fetchDayFromNexon(type, date) {
  const { path, listKey } = TYPES[type];
  const items = [];
  let cursor = null;
  for (let i = 0; i < 30; i++) {
    const params = cursor ? { count: 1000, cursor } : { count: 1000, date };
    const data = await nexonGet(`/maplestory/v1/history/${path}`, params);
    items.push(...(data[listKey] || []));
    cursor = data.next_cursor;
    if (!cursor) break;
  }
  return items;
}

/**
 * 기간 이력 조회 — 과거 날짜는 DB에 영구 캐시(응답 불변), 오늘만 매번 재조회.
 * 전체 기간(2023-12-27~)도 두 번째 호출부터는 DB에서 즉시 반환된다.
 */
export async function fetchRange(type, from, to) {
  const today = todayKST();
  const minDate = minDateKST();
  const dates = [];
  for (let t = new Date(`${from}T00:00:00+09:00`).getTime(); t <= new Date(`${to}T00:00:00+09:00`).getTime(); t += DAY_MS) {
    const d = new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
    if (d >= minDate && d <= today) dates.push(d);
  }
  if (dates.length === 0) return [];

  const cached = await EnchantHistoryCache.findAll({
    where: { type, date: { [Op.in]: dates } },
    attributes: ['date', 'payload'],
  });
  const cacheMap = new Map(cached.map((c) => [String(c.date), c.payload]));

  // 오늘은 계속 바뀌므로 캐시를 쓰지 않고 항상 갱신
  const missing = dates.filter((d) => d === today || !cacheMap.has(d));

  for (let i = 0; i < missing.length; i += 4) {
    const chunk = missing.slice(i, i + 4);
    const results = await Promise.all(chunk.map(async (d) => ({ date: d, items: await fetchDayFromNexon(type, d) })));
    for (const { date, items } of results) {
      cacheMap.set(date, items);
      if (date !== today) {
        await EnchantHistoryCache.upsert({ type, date, payload: items, count: items.length });
      }
    }
  }

  const all = [];
  for (const d of dates) all.push(...(cacheMap.get(d) || []));
  all.sort((a, b) => (a.date_create < b.date_create ? 1 : -1));
  return all;
}

// ─────────── 아이템/월드 아이콘 ───────────

const ocidCache = new Map();     // 캐릭터명 → ocid
const charInfoCache = new Map(); // 캐릭터명 → { at, icons, worldName }
const ioIconCache = new Map();   // 아이템명 → url|null (maplestory.io 폴백)
const ICON_TTL = 60 * 60 * 1000;

// 정규 월드 (그 외는 이벤트/테스트 월드로 간주)
const NORMAL_WORLDS = [
  '스카니아', '베라', '루나', '제니스', '크로아', '유니온', '엘리시움', '이노시스',
  '레드', '오로라', '아케인', '노바', '리부트', '버닝', '챌린저스',
];

export function isNormalWorld(world) {
  if (!world) return false;
  return NORMAL_WORLDS.some((w) => world === w || world.startsWith(w));
}

export async function fetchCharacterInfo(characterName) {
  const cached = charInfoCache.get(characterName);
  if (cached && Date.now() - cached.at < ICON_TTL) return cached;

  let ocid = ocidCache.get(characterName);
  if (!ocid) {
    const idData = await nexonGet('/maplestory/v1/id', { character_name: characterName });
    ocid = idData.ocid;
    ocidCache.set(characterName, ocid);
  }
  const [equip, basic] = await Promise.all([
    nexonGet('/maplestory/v1/character/item-equipment', { ocid }).catch(() => null),
    nexonGet('/maplestory/v1/character/basic', { ocid }).catch(() => null),
  ]);
  const icons = {};
  const levels = {};
  const collect = (list) => {
    for (const eq of list || []) {
      if (!eq.item_name) continue;
      if (eq.item_icon && !icons[eq.item_name]) icons[eq.item_name] = eq.item_icon;
      const lv = eq.item_base_option?.base_equipment_level;
      if (lv && !levels[eq.item_name]) levels[eq.item_name] = Number(lv);
    }
  };
  if (equip) {
    collect(equip.item_equipment);
    collect(equip.item_equipment_preset_1);
    collect(equip.item_equipment_preset_2);
    collect(equip.item_equipment_preset_3);
  }
  const entry = {
    at: Date.now(),
    icons,
    levels,
    worldName: basic?.world_name || null,
    characterImage: basic?.character_image || null,
    characterLevel: basic?.character_level ?? null,
  };
  charInfoCache.set(characterName, entry);
  return entry;
}

// 계정 전체 캐릭터의 장착 아이콘 사전 (넥슨 static 아이콘) — 1시간 캐시
let accountIconCache = null; // { at, icons, levels }

export async function fetchAccountIcons() {
  if (accountIconCache && Date.now() - accountIconCache.at < ICON_TTL) return accountIconCache;

  const icons = {};
  const levels = {};
  try {
    const list = await nexonGet('/maplestory/v1/character/list', {});
    const ocids = [];
    for (const acc of list.account_list || []) {
      for (const c of acc.character_list || []) {
        if (c.ocid) ocids.push(c.ocid);
      }
    }
    // 계정 캐릭터 전체의 장착 장비를 훑어 이름→아이콘 사전 구축
    for (let i = 0; i < ocids.length; i += 4) {
      const chunk = ocids.slice(i, i + 4);
      const results = await Promise.all(chunk.map((ocid) =>
        nexonGet('/maplestory/v1/character/item-equipment', { ocid }).catch(() => null)
      ));
      for (const equip of results) {
        if (!equip) continue;
        for (const key of ['item_equipment', 'item_equipment_preset_1', 'item_equipment_preset_2', 'item_equipment_preset_3']) {
          for (const eq of equip[key] || []) {
            if (!eq.item_name) continue;
            if (eq.item_icon && !icons[eq.item_name]) icons[eq.item_name] = eq.item_icon;
            const lv = eq.item_base_option?.base_equipment_level;
            if (lv && !levels[eq.item_name]) levels[eq.item_name] = Number(lv);
          }
        }
      }
    }
  } catch (err) {
    console.error('계정 아이콘 수집 오류:', err.message);
  }
  accountIconCache = { at: Date.now(), icons, levels };
  return accountIconCache;
}

/** maplestory.io 폴백 — 계정 어디에도 장착돼 있지 않은 아이템 (아이콘 + 착용 레벨) */
export async function fetchIoIcon(itemName) {
  if (ioIconCache.has(itemName)) return ioIconCache.get(itemName);
  let entry = { url: null, level: null };
  try {
    const { data } = await axios.get('https://maplestory.io/api/KMS/389/item', {
      params: { searchFor: itemName, count: 5 },
      timeout: 8000,
    });
    // 이름이 정확히 같은 것만 레벨을 신뢰 (부분 일치는 다른 아이템일 수 있음)
    const exact = (data || []).find((i) => i.name === itemName);
    const pick = exact || (data || [])[0];
    if (pick?.id) entry.url = `https://maplestory.io/api/KMS/389/item/${pick.id}/icon`;
    if (exact?.requiredLevel) entry.level = Number(exact.requiredLevel);
  } catch { /* 실패 시 아이콘 없음 */ }
  ioIconCache.set(itemName, entry);
  return entry;
}
