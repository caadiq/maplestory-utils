import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCharacterList, getCharacterOcid, getCharacterBasic } from '../services/nexon.js';
import { UserCharacter } from '../models/index.js';

const router = Router();

// 내 캐릭터 목록 조회
router.get('/', requireAuth, async (req, res) => {
  try {
    const characters = await UserCharacter.findAll({
      where: { user_id: req.session.userId },
      order: [['character_level', 'DESC']],
    });
    res.json(characters);
  } catch (err) {
    console.error('캐릭터 목록 조회 오류:', err.message);
    res.status(500).json({ error: '캐릭터 목록 조회 실패' });
  }
});

// 캐릭터 목록 갱신 (넥슨 API에서 다시 가져오기)
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const charList = await getCharacterList(req.session.accessToken);

    if (!charList?.account_list) {
      return res.status(400).json({ error: '캐릭터 목록을 가져올 수 없습니다' });
    }

    const results = [];

    for (const account of charList.account_list) {
      for (const char of account.character_list || []) {
        try {
          const ocid = await getCharacterOcid(char.character_name);
          const basic = await getCharacterBasic(ocid);

          const [userChar] = await UserCharacter.upsert({
            user_id: req.session.userId,
            character_name: char.character_name,
            ocid,
            world_name: basic.world_name,
            job_name: basic.character_class,
            character_level: basic.character_level,
            character_image: basic.character_image,
          });

          results.push(userChar);
        } catch (err) {
          console.error(`캐릭터 조회 실패: ${char.character_name}`, err.message);
        }
      }
    }

    res.json(results);
  } catch (err) {
    console.error('캐릭터 갱신 오류:', err.message);
    res.status(500).json({ error: '캐릭터 목록 갱신 실패' });
  }
});

export default router;
