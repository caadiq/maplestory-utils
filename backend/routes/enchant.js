import { Router } from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/session.js';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

const NEXON_BASE = 'https://open.api.nexon.com/maplestory/v1/history';
const TYPES = {
  starforce: { path: 'starforce', listKey: 'starforce_history' },
  cube: { path: 'cube', listKey: 'cube_history' },
  potential: { path: 'potential', listKey: 'potential_history' },
};

// 과거 날짜 응답은 불변 — 메모리 캐시 (오늘 데이터는 짧게)
const cache = new Map(); // key: `${type}:${date}` → { at, items }
const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY_TTL = 5 * 60 * 1000;

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
      if (err.response?.status === 429 && attempt < 4) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}

function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function fetchDay(type, date) {
  const { path, listKey } = TYPES[type];
  const key = `${type}:${date}`;
  const cached = cache.get(key);
  const isToday = date === todayKST();
  if (cached && (!isToday ? true : Date.now() - cached.at < TODAY_TTL)) return cached.items;

  const items = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) { // 페이징 안전 상한
    const params = cursor ? { count: 1000, cursor } : { count: 1000, date };
    const data = await nexonGet(`${NEXON_BASE}/${path}`, params);
    items.push(...(data[listKey] || []));
    cursor = data.next_cursor;
    if (!cursor) break;
  }
  cache.set(key, { at: Date.now(), items });
  // 캐시 크기 제한
  if (cache.size > 500) {
    const oldest = [...cache.keys()].slice(0, 100);
    oldest.forEach((k) => cache.delete(k));
  }
  return items;
}

/**
 * GET /api/enchant/history?type=starforce&from=YYYY-MM-DD&to=YYYY-MM-DD
 * 기간 내 날짜별 이력을 모두 수집해 시간 역순으로 반환.
 * 넥슨 API는 하루 단위 조회라 서버에서 날짜 루프 + 커서 페이징 처리.
 */
router.get('/history', requireAuth, async (req, res) => {
  const { type, from, to } = req.query;
  if (!TYPES[type]) return res.status(400).json({ error: '잘못된 type' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
    return res.status(400).json({ error: 'from/to 날짜가 필요합니다 (YYYY-MM-DD)' });
  }

  const start = new Date(`${from}T00:00:00+09:00`).getTime();
  const end = new Date(`${to}T00:00:00+09:00`).getTime();
  if (end < start) return res.status(400).json({ error: '기간이 잘못되었습니다' });
  if ((end - start) / DAY_MS > 366) return res.status(400).json({ error: '최대 1년까지 조회할 수 있습니다' });

  // 넥슨 데이터 제공 시작일(2023-12-27) 이전은 요청하지 않음
  const MIN_DATE = '2023-12-27';

  try {
    const dates = [];
    for (let t = start; t <= end; t += DAY_MS) {
      const d = new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
      if (d >= MIN_DATE && d <= todayKST()) dates.push(d);
    }
    const results = [];
    // 넥슨 rate limit 배려 — 5개씩 병렬
    for (let i = 0; i < dates.length; i += 5) {
      const chunk = dates.slice(i, i + 5);
      const chunkResults = await Promise.all(chunk.map((d) => fetchDay(type, d)));
      chunkResults.forEach((items) => results.push(...items));
    }
    results.sort((a, b) => (a.date_create < b.date_create ? 1 : -1));
    res.json({ count: results.length, items: results });
  } catch (err) {
    const status = err.response?.status;
    console.error('강화 이력 조회 오류:', status, err.response?.data?.error?.message || err.message);
    if (status === 429) return res.status(429).json({ error: '넥슨 API 요청 한도 초과 — 잠시 후 다시 시도해주세요' });
    res.status(500).json({ error: '강화 이력 조회 실패' });
  }
});

// 캐릭터 장착 장비의 item_name → item_icon 매핑 (넥슨 정적 아이콘 URL)
const ocidCache = new Map(); // name → ocid
const iconCache = new Map(); // character → { at, icons: { name: url } }
const ICON_TTL = 60 * 60 * 1000;

async function fetchCharacterIcons(characterName) {
  const cached = iconCache.get(characterName);
  if (cached && Date.now() - cached.at < ICON_TTL) return cached;

  let ocid = ocidCache.get(characterName);
  if (!ocid) {
    const idData = await nexonGet('https://open.api.nexon.com/maplestory/v1/id', { character_name: characterName });
    ocid = idData.ocid;
    ocidCache.set(characterName, ocid);
  }
  const [data, basic] = await Promise.all([
    nexonGet('https://open.api.nexon.com/maplestory/v1/character/item-equipment', { ocid }),
    nexonGet('https://open.api.nexon.com/maplestory/v1/character/basic', { ocid }).catch(() => null),
  ]);
  const icons = {};
  const collect = (list) => {
    for (const eq of list || []) {
      if (eq.item_name && eq.item_icon && !icons[eq.item_name]) icons[eq.item_name] = eq.item_icon;
    }
  };
  collect(data.item_equipment);
  collect(data.item_equipment_preset_1);
  collect(data.item_equipment_preset_2);
  collect(data.item_equipment_preset_3);
  const entry = { at: Date.now(), icons, worldName: basic?.world_name || null };
  iconCache.set(characterName, entry);
  return entry;
}

// "월드 : 월드명" 형식으로 등록된 이미지에서 월드 아이콘 매핑
async function worldIconMap(worldNames) {
  if (!worldNames.length) return {};
  const images = await Image.findAll({
    where: { [Op.or]: [{ name: { [Op.like]: '월드%' } }, ...worldNames.map((w) => ({ name: w }))] },
  });
  const map = {};
  for (const img of images) {
    const m = img.name.match(/^월드\s*:\s*(.+)$/);
    const key = m ? m[1].trim() : img.name.trim();
    map[key] = getPublicUrl(img.path);
  }
  return map;
}

/**
 * GET /api/enchant/item-icons?characters=이름1,이름2
 * 각 캐릭터의 장착 장비(프리셋 포함)에서 장비명 → 아이콘 URL 매핑을 병합해 반환.
 * 이력에 있지만 장착 중이 아닌 장비는 매핑에 없을 수 있음.
 */
router.get('/item-icons', requireAuth, async (req, res) => {
  const names = (req.query.characters || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (names.length === 0) return res.json({});
  try {
    const merged = {};
    const charWorlds = {};
    for (let i = 0; i < names.length; i += 3) {
      const chunk = names.slice(i, i + 3);
      const results = await Promise.all(chunk.map((n) => fetchCharacterIcons(n).catch(() => null)));
      results.forEach((entry, idx) => {
        if (!entry) return;
        Object.assign(merged, entry.icons);
        if (entry.worldName) charWorlds[chunk[idx]] = entry.worldName;
      });
    }
    const worlds = await worldIconMap([...new Set(Object.values(charWorlds))]);
    const characterWorldIcons = {};
    for (const [name, world] of Object.entries(charWorlds)) {
      characterWorldIcons[name] = worlds[world] || null;
    }
    res.json({ items: merged, characterWorldIcons });
  } catch (err) {
    console.error('아이템 아이콘 조회 오류:', err.message);
    res.status(500).json({ error: '아이콘 조회 실패' });
  }
});

export default router;
