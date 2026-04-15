import { Router } from 'express';
import axios from 'axios';

const router = Router();

const NEXON_API_BASE = 'https://open.api.nexon.com';

const ENDPOINT_MAP = {
  event: '/maplestory/v1/notice-event',
  update: '/maplestory/v1/notice-update',
  notice: '/maplestory/v1/notice',
  cashshop: '/maplestory/v1/notice-cashshop',
};

router.get('/', async (req, res) => {
  const type = req.query.type || 'event';
  const endpoint = ENDPOINT_MAP[type];
  if (!endpoint) return res.status(400).json({ error: '잘못된 type입니다' });

  try {
    const { data } = await axios.get(`${NEXON_API_BASE}${endpoint}`, {
      headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
    });
    res.json(data);
  } catch (err) {
    const errData = err.response?.data?.error;
    const code = errData?.name;
    // Nexon 점검 코드: OPENAPI00001(게임 점검), OPENAPI00007(api 점검), OPENAPI00011(오픈 API 점검)
    const underMaintenance = ['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'].includes(code);
    if (underMaintenance) {
      return res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    }
    console.error(`공지 조회 오류 (${type}):`, err.response?.data || err.message);
    res.status(500).json({ error: '공지 조회 실패' });
  }
});

export default router;
