import { Router } from 'express';
import { nexonGet, handleNexonError } from '../lib/nexon.js';

const router = Router();

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
    const { data } = await nexonGet(endpoint);
    res.json(data);
  } catch (err) {
    handleNexonError(err, res, { label: `공지 조회 오류 (${type})`, failMsg: '공지 조회 실패' });
  }
});

export default router;
