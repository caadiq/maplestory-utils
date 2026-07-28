import { Router } from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/session.js';
import { Image, EnchantHistoryCache } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

const NEXON_BASE = 'https://open.api.nexon.com/maplestory/v1/history';
const TYPES = {
  starforce: { path: 'starforce', listKey: 'starforce_history' },
  cube: { path: 'cube', listKey: 'cube_history' },
  potential: { path: 'potential', listKey: 'potential_history' },
};

const DAY_MS = 24 * 60 * 60 * 1000;
// 넥슨은 최근 약 2년(729일)치만 제공 — 그보다 과거는 400을 반환하므로 요청하지 않는다
const MAX_HISTORY_DAYS = 728;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 넥슨 GET — 429(rate limit) 시 지수 백오프 재시도 */
async function nexonGet(url, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await axios.get(url, {
        params,
        headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
      });
      return data;
    } catch (err) {
      if (err.response?.status === 429 && attempt < 5) {
        await sleep(400 * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}

function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 조회 가능한 가장 이른 날짜 (오늘 - 728일) */
function minDateKST() {
  return new Date(Date.now() + 9 * 3600 * 1000 - MAX_HISTORY_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/** 넥슨에서 하루치 이력 수집 (커서 페이징) */
async function fetchDayFromNexon(type, date) {
  const { path, listKey } = TYPES[type];
  const items = [];
  let cursor = null;
  for (let i = 0; i < 30; i++) {
    const params = cursor ? { count: 1000, cursor } : { count: 1000, date };
    const data = await nexonGet(`${NEXON_BASE}/${path}`, params);
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
async function fetchRange(type, from, to) {
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

/** GET /api/enchant/history?type=&from=&to= (from 생략 시 전체 기간) */
router.get('/history', requireAuth, async (req, res) => {
  const { type } = req.query;
  if (!TYPES[type]) return res.status(400).json({ error: '잘못된 type' });

  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : minDateKST();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : todayKST();
  if (to < from) return res.status(400).json({ error: '기간이 잘못되었습니다' });

  try {
    const items = await fetchRange(type, from, to);
    res.json({ count: items.length, items });
  } catch (err) {
    const status = err.response?.status;
    console.error('강화 이력 조회 오류:', status, err.response?.data?.error?.message || err.message);
    if (status === 429) return res.status(429).json({ error: '넥슨 API 요청 한도 초과 — 잠시 후 다시 시도해주세요' });
    res.status(500).json({ error: '강화 이력 조회 실패' });
  }
});

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

function isNormalWorld(world) {
  if (!world) return false;
  return NORMAL_WORLDS.some((w) => world === w || world.startsWith(w));
}

async function fetchCharacterInfo(characterName) {
  const cached = charInfoCache.get(characterName);
  if (cached && Date.now() - cached.at < ICON_TTL) return cached;

  let ocid = ocidCache.get(characterName);
  if (!ocid) {
    const idData = await nexonGet('https://open.api.nexon.com/maplestory/v1/id', { character_name: characterName });
    ocid = idData.ocid;
    ocidCache.set(characterName, ocid);
  }
  const [equip, basic] = await Promise.all([
    nexonGet('https://open.api.nexon.com/maplestory/v1/character/item-equipment', { ocid }).catch(() => null),
    nexonGet('https://open.api.nexon.com/maplestory/v1/character/basic', { ocid }).catch(() => null),
  ]);
  const icons = {};
  const collect = (list) => {
    for (const eq of list || []) {
      if (eq.item_name && eq.item_icon && !icons[eq.item_name]) icons[eq.item_name] = eq.item_icon;
    }
  };
  if (equip) {
    collect(equip.item_equipment);
    collect(equip.item_equipment_preset_1);
    collect(equip.item_equipment_preset_2);
    collect(equip.item_equipment_preset_3);
  }
  const entry = { at: Date.now(), icons, worldName: basic?.world_name || null };
  charInfoCache.set(characterName, entry);
  return entry;
}

// 계정 전체 캐릭터의 장착 아이콘 사전 (넥슨 static 아이콘) — 1시간 캐시
let accountIconCache = null; // { at, icons }

async function fetchAccountIcons() {
  if (accountIconCache && Date.now() - accountIconCache.at < ICON_TTL) return accountIconCache.icons;

  const icons = {};
  try {
    const list = await nexonGet('https://open.api.nexon.com/maplestory/v1/character/list', {});
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
        nexonGet('https://open.api.nexon.com/maplestory/v1/character/item-equipment', { ocid }).catch(() => null)
      ));
      for (const equip of results) {
        if (!equip) continue;
        for (const key of ['item_equipment', 'item_equipment_preset_1', 'item_equipment_preset_2', 'item_equipment_preset_3']) {
          for (const eq of equip[key] || []) {
            if (eq.item_name && eq.item_icon && !icons[eq.item_name]) icons[eq.item_name] = eq.item_icon;
          }
        }
      }
    }
  } catch (err) {
    console.error('계정 아이콘 수집 오류:', err.message);
  }
  accountIconCache = { at: Date.now(), icons };
  return icons;
}

/** maplestory.io 폴백 — 계정 어디에도 장착돼 있지 않은 아이템 */
async function fetchIoIcon(itemName) {
  if (ioIconCache.has(itemName)) return ioIconCache.get(itemName);
  let url = null;
  try {
    const { data } = await axios.get('https://maplestory.io/api/KMS/389/item', {
      params: { searchFor: itemName, count: 5 },
      timeout: 8000,
    });
    const exact = (data || []).find((i) => i.name === itemName) || (data || [])[0];
    if (exact?.id) url = `https://maplestory.io/api/KMS/389/item/${exact.id}/icon`;
  } catch { /* 실패 시 아이콘 없음 */ }
  ioIconCache.set(itemName, url);
  return url;
}

/**
 * GET /api/enchant/item-icons?characters=a,b&items=x,y
 * - characters: 장착 장비 아이콘 + 월드 정보(정규 월드 여부)
 * - items: 장착 목록에 없는 아이템은 maplestory.io로 폴백 조회
 */
router.get('/item-icons', requireAuth, async (req, res) => {
  const names = (req.query.characters || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const wantedItems = (req.query.items || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 300);

  try {
    // 계정 전체 장착 사전 먼저 (넥슨 static 아이콘)
    const merged = { ...(await fetchAccountIcons()) };
    const characterWorlds = {};
    for (let i = 0; i < names.length; i += 3) {
      const chunk = names.slice(i, i + 3);
      const results = await Promise.all(chunk.map((n) => fetchCharacterInfo(n).catch(() => null)));
      results.forEach((entry, idx) => {
        if (!entry) return;
        Object.assign(merged, entry.icons);
        characterWorlds[chunk[idx]] = entry.worldName;
      });
    }

    const missing = wantedItems.filter((n) => !merged[n]);
    for (let i = 0; i < missing.length; i += 6) {
      const chunk = missing.slice(i, i + 6);
      const urls = await Promise.all(chunk.map((n) => fetchIoIcon(n)));
      urls.forEach((u, idx) => { if (u) merged[chunk[idx]] = u; });
    }

    const worlds = [...new Set(Object.values(characterWorlds).filter(Boolean))];
    const worldIconMap = {};
    if (worlds.length) {
      const images = await Image.findAll({
        where: { [Op.or]: [{ name: { [Op.like]: '월드%' } }, ...worlds.map((w) => ({ name: w }))] },
      });
      for (const img of images) {
        const m = img.name.match(/^월드\s*:\s*(.+)$/);
        worldIconMap[(m ? m[1] : img.name).trim()] = getPublicUrl(img.path);
      }
    }

    const characters = {};
    for (const [name, world] of Object.entries(characterWorlds)) {
      characters[name] = {
        world,
        worldIcon: world ? worldIconMap[world] || null : null,
        normalWorld: isNormalWorld(world),
      };
    }

    res.json({ items: merged, characters });
  } catch (err) {
    console.error('아이템 아이콘 조회 오류:', err.message);
    res.status(500).json({ error: '아이콘 조회 실패' });
  }
});

export default router;
