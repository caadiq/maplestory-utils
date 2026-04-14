import { Router } from 'express';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

// 이름으로 이미지 URL 조회 (공개)
router.get('/:name', async (req, res) => {
  try {
    const image = await Image.findOne({ where: { name: req.params.name } });
    if (!image) return res.status(404).json({ error: '이미지 없음' });
    res.json({ name: image.name, url: getPublicUrl(image.path) });
  } catch (err) {
    console.error('이미지 조회 오류:', err.message);
    res.status(500).json({ error: '이미지 조회 실패' });
  }
});

export default router;
