import { Router } from 'express';
import { GenesisPass, Image } from '../../models/index.js';
import { serializeGenesisPass } from '../genesis-pass.js';

const router = Router();

async function findWithImage() {
  return GenesisPass.findOne({ include: [{ model: Image, as: 'image' }] });
}

// 관리자: 제네시스 패스 시즌 설정 조회
router.get('/', async (_req, res) => {
  try {
    const row = await findWithImage();
    res.json(serializeGenesisPass(row));
  } catch (err) {
    console.error('제네시스 패스 조회 오류:', err.message);
    res.status(500).json({ error: '조회 실패' });
  }
});

// 관리자: 제네시스 패스 시즌 설정 저장 (단일 행 upsert)
router.patch('/', async (req, res) => {
  const { start_date, end_date, multiplier, image_id } = req.body;

  try {
    let row = await GenesisPass.findOne();
    if (!row) row = await GenesisPass.create({});

    if (start_date !== undefined) row.start_date = start_date || null;
    if (end_date !== undefined) row.end_date = end_date || null;
    if (multiplier !== undefined) {
      const m = Number(multiplier);
      if (isNaN(m) || m <= 0) return res.status(400).json({ error: '배수는 0보다 커야 합니다' });
      row.multiplier = m;
    }
    if (image_id !== undefined) row.image_id = image_id || null;

    if (row.start_date && row.end_date && row.start_date > row.end_date) {
      return res.status(400).json({ error: '시작일이 종료일보다 늦을 수 없습니다' });
    }

    await row.save();
    const updated = await findWithImage();
    res.json(serializeGenesisPass(updated));
  } catch (err) {
    console.error('제네시스 패스 저장 오류:', err.message);
    res.status(400).json({ error: err.message || '저장 실패' });
  }
});

export default router;
