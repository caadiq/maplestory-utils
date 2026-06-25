import { Router } from 'express';
import { UserCharacter } from '../models/index.js';
import { requireAuth } from '../middleware/session.js';
import { attachWorldIcons } from '../services/character.js';

const router = Router();

// 이하 모든 라우트는 로그인 필요
router.use(requireAuth);

// 로그인 계정의 캐릭터 목록 (자동완성용). 로그인 시 캐시된 user_characters 기반.
router.get('/characters', async (req, res) => {
  try {
    const rows = await UserCharacter.findAll({
      where: { user_id: req.user.id },
      order: [['character_level', 'DESC'], ['id', 'ASC']],
    });
    const characters = await attachWorldIcons(rows.map((r) => ({
      ocid: r.ocid,
      character_name: r.character_name,
      world_name: r.world_name,
      job_name: r.job_name,
      character_level: r.character_level,
    })));
    res.json({ characters });
  } catch (err) {
    console.error('캐릭터 목록 조회 오류:', err.message);
    res.status(500).json({ error: '캐릭터 목록 조회 실패' });
  }
});

export default router;
