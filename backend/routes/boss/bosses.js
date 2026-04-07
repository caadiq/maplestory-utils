import { Router } from 'express';
import { Boss, BossDifficulty } from '../../models/index.js';

const router = Router();

// 보스 목록 + 난이도별 결정석 가격
router.get('/', async (_req, res) => {
  try {
    const bosses = await Boss.findAll({
      include: [{ model: BossDifficulty, as: 'difficulties' }],
      order: [
        ['sort_order', 'ASC'],
        [{ model: BossDifficulty, as: 'difficulties' }, 'crystal_price', 'DESC'],
      ],
    });
    res.json(bosses);
  } catch (err) {
    console.error('보스 목록 조회 오류:', err.message);
    res.status(500).json({ error: '보스 목록 조회 실패' });
  }
});

export default router;
