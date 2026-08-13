import { Router } from 'express';
import { UserCharacter, UserState } from '../models/index.js';
import { requireAuth } from '../middleware/session.js';
import { attachWorldIcons } from '../services/character.js';

const router = Router();
const FEATURES = ['boss-crystal', 'symbol', 'liberation', 'hexa-matrix'];

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

// feature별 사용자 데이터(계산기 상태) 조회/저장 — payload는 JSON 그대로 보관
router.get('/state/:feature', async (req, res) => {
  const { feature } = req.params;
  if (!FEATURES.includes(feature)) return res.status(400).json({ error: '알 수 없는 기능' });
  try {
    const row = await UserState.findOne({ where: { user_id: req.user.id, feature } });
    res.json({ payload: row?.payload ?? null });
  } catch (err) {
    console.error('상태 조회 오류:', err.message);
    res.status(500).json({ error: '상태 조회 실패' });
  }
});

router.put('/state/:feature', async (req, res) => {
  const { feature } = req.params;
  if (!FEATURES.includes(feature)) return res.status(400).json({ error: '알 수 없는 기능' });
  const { payload } = req.body;
  if (payload == null || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload가 필요합니다' });
  }
  try {
    const [row, created] = await UserState.findOrCreate({
      where: { user_id: req.user.id, feature },
      defaults: { payload },
    });
    if (!created) {
      row.payload = payload;
      await row.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('상태 저장 오류:', err.message);
    res.status(500).json({ error: '상태 저장 실패' });
  }
});

export default router;
