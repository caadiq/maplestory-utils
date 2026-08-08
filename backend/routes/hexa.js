import { Router } from 'express';
import { attachWorldIcons } from '../services/character.js';
import { nexonGet, getOcid, handleNexonError } from '../lib/nexon.js';
import { parseCores } from '../services/hexa.js';

const router = Router();

/**
 * 헥사 코어 조회 — 코어 목록(레벨·타입)과 연결 스킬 아이콘까지 한 번에.
 *
 * 아이콘은 hexamatrix 응답에 없어서 6차 스킬 목록(skill_icon 포함)과
 * 스킬명으로 매칭한다. 마스터리 코어처럼 "빅뱅 VI"류는 linked_skill이
 * "빅뱅 VI"로 오고, 강화 코어는 "프레이"처럼 원 스킬명으로 와서
 * 그대로 / "+ VI" 두 가지로 찾아본다.
 */
router.get('/lookup', async (req, res) => {
  const name = req.query.name?.trim();
  if (!name) return res.status(400).json({ error: '캐릭터 닉네임을 입력해주세요' });

  try {
    const ocid = await getOcid(name);

    const [{ data: basic }, { data: hexa }, { data: skill6 }] = await Promise.all([
      nexonGet('/maplestory/v1/character/basic', { ocid }),
      nexonGet('/maplestory/v1/character/hexamatrix', { ocid }),
      nexonGet('/maplestory/v1/character/skill', { ocid, character_skill_grade: 6 }),
    ]);

    const cores = parseCores(hexa, skill6);

    const [character] = await attachWorldIcons([{
      ocid,
      character_name: basic.character_name,
      world_name: basic.world_name,
      job_name: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
    }]);

    res.json({ character, cores });
  } catch (err) {
    handleNexonError(err, res, { label: '헥사 조회 오류', notFound: '존재하지 않는 캐릭터입니다', failMsg: '헥사 정보 조회 실패' });
  }
});

export default router;
