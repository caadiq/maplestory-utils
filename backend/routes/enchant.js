import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/session.js';

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
    const { data } = await axios.get(`${NEXON_BASE}/${path}`, {
      params,
      headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
    });
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
  if ((end - start) / DAY_MS > 31) return res.status(400).json({ error: '최대 31일까지 조회할 수 있습니다' });

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

export default router;
