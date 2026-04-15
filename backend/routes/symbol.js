import { Router } from 'express';
import { Symbol, SymbolLevel } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const rows = await Symbol.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [{ model: SymbolLevel, as: 'levels' }],
    });
    res.json(rows.map((s) => {
      const j = s.toJSON();
      return {
        id: j.id,
        type: j.type,
        region: j.region,
        image_url: j.image ? getPublicUrl(j.image) : null,
        max_level: j.max_level,
        daily_default: j.daily_default,
        weekly_default: j.weekly_default,
        sort_order: j.sort_order,
        levels: (j.levels || [])
          .sort((a, b) => a.level - b.level)
          .map((l) => ({
            level: l.level,
            required_count: l.required_count,
            meso_cost: Number(l.meso_cost),
          })),
      };
    }));
  } catch (err) {
    console.error('심볼 목록 조회 오류:', err.message);
    res.status(500).json({ error: '심볼 목록 조회 실패' });
  }
});

export default router;
