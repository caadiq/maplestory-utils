import { Router } from 'express';
import { BossCrystalBoss, BossCrystalBossDifficulty, ChallengerSeason } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

// 공개 보스 목록
router.get('/bosses', async (_req, res) => {
  try {
    const bosses = await BossCrystalBoss.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [
        { model: BossCrystalBossDifficulty, as: 'difficulties' },
        { model: ChallengerSeason, as: 'season' },
      ],
    });
    res.json(bosses.map((b) => {
      const json = b.toJSON();
      return {
        id: json.id,
        name: json.name,
        image_url: json.image_path ? getPublicUrl(json.image_path) : null,
        max_party_size: json.max_party_size,
        season: json.season
          ? { season_number: json.season.season_number, start_date: json.season.start_date, end_date: json.season.end_date }
          : null,
        difficulties: (json.difficulties || []).map((d) => ({
          difficulty: d.difficulty,
          crystal_price: Number(d.crystal_price),
        })),
      };
    }));
  } catch (err) {
    console.error('보스 목록 조회 오류:', err.message);
    res.status(500).json({ error: '보스 목록 조회 실패' });
  }
});

export default router;
