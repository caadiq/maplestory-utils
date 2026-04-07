import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { UserBossSelection, BossDifficulty, Boss } from '../../models/index.js';

const router = Router();

// 내 캐릭터별 보스 선택 현황
router.get('/', requireAuth, async (req, res) => {
  try {
    const selections = await UserBossSelection.findAll({
      where: { user_id: req.session.userId },
      include: [{
        model: BossDifficulty,
        as: 'difficulty',
        include: [{ model: Boss }],
      }],
    });
    res.json(selections);
  } catch (err) {
    console.error('선택 조회 오류:', err.message);
    res.status(500).json({ error: '보스 선택 조회 실패' });
  }
});

// 캐릭터별 보스 선택 저장
router.put('/:characterId', requireAuth, async (req, res) => {
  const { characterId } = req.params;
  const { selections } = req.body; // [{ boss_difficulty_id, party_size }]

  try {
    // 기존 선택 삭제
    await UserBossSelection.destroy({
      where: {
        user_id: req.session.userId,
        user_character_id: characterId,
      },
    });

    // 새 선택 생성
    if (selections?.length) {
      await UserBossSelection.bulkCreate(
        selections.map((s) => ({
          user_id: req.session.userId,
          user_character_id: characterId,
          boss_difficulty_id: s.boss_difficulty_id,
          party_size: s.party_size || 1,
        }))
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('선택 저장 오류:', err.message);
    res.status(500).json({ error: '보스 선택 저장 실패' });
  }
});

export default router;
