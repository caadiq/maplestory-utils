import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { UserCharacter, UserBossSelection, BossDifficulty, Boss } from '../../models/index.js';
import { calculateRevenue } from '../../services/boss/calculator.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const characters = await UserCharacter.findAll({
      where: { user_id: req.session.userId },
      include: [{
        model: UserBossSelection,
        as: 'selections',
        include: [{
          model: BossDifficulty,
          as: 'difficulty',
          include: [{ model: Boss }],
        }],
      }],
    });

    const result = calculateRevenue(characters);
    res.json(result);
  } catch (err) {
    console.error('수익 계산 오류:', err.message);
    res.status(500).json({ error: '수익 계산 실패' });
  }
});

export default router;
