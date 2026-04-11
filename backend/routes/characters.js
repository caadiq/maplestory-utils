import { Router } from 'express';
import { getCharacterOcid, getCharacterBasic } from '../services/nexon.js';

const router = Router();

// 캐릭터 닉네임으로 정보 조회
router.get('/search', async (req, res) => {
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: '캐릭터 닉네임을 입력해주세요' });
  }

  try {
    const ocid = await getCharacterOcid(name);
    const basic = await getCharacterBasic(ocid);

    res.json({
      character_name: basic.character_name,
      world_name: basic.world_name,
      job_name: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
    });
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(404).json({ error: '존재하지 않는 캐릭터입니다' });
    }
    console.error('캐릭터 조회 오류:', err.message);
    res.status(500).json({ error: '캐릭터 조회 실패' });
  }
});

export default router;
