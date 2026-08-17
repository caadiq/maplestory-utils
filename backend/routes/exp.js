import { Router } from 'express';
import { getOcid, nexonGet, handleNexonError } from '../lib/nexon.js';
import { attachWorldIcons } from '../services/character.js';
import { expData, loadIcons, parseExpBonus, fetchHistory } from '../services/exp.js';

const router = Router();

router.get('/data', async (_req, res) => {
  try {
    // 관리자가 아이콘을 추가하면 곧 반영돼야 한다 — 길게 잡으면 한참 뒤에야 보인다
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ ...expData, icons: await loadIcons() });
  } catch (err) {
    console.error('경험치 데이터 조회 오류:', err.message);
    res.status(500).json({ error: '데이터 조회 실패' });
  }
});

/**
 * 캐릭터 조회 — 레벨과 **그 캐릭터가 받고 있는 경험치 보너스**를 함께 준다.
 *
 * 보너스를 캐릭터에서 읽는 이유: 보약(훈련 일지)은 서버마다 찍은 단계가 달라
 * "이 레벨이면 얼마"를 고정값으로 말할 수 없다. 캐릭터를 고르면 그 값이 반영되고,
 * 레벨만 입력해서 볼 때는 보너스 없이 순수 기본값을 본다.
 */
router.get('/lookup', async (req, res) => {
  const name = req.query.name?.trim();
  if (!name) return res.status(400).json({ error: '캐릭터 닉네임을 입력해주세요' });

  try {
    const ocid = await getOcid(name);
    const [{ data: basic }, skillRes, history] = await Promise.all([
      nexonGet('/maplestory/v1/character/basic', { ocid }),
      nexonGet('/maplestory/v1/character/skill', { ocid, character_skill_grade: '0' })
        .catch(() => ({ data: { character_skill: [] } })),
      fetchHistory(ocid).catch(() => []),
    ]);

    const [character] = await attachWorldIcons([{
      ocid,
      character_name: basic.character_name,
      world_name: basic.world_name,
      job_name: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
    }]);

    res.json({
      character,
      exp_rate: Number(basic.character_exp_rate) || 0,
      bonus: parseExpBonus(skillRes.data?.character_skill),
      date_create: basic.character_date_create || null,
      history,
    });
  } catch (err) {
    handleNexonError(err, res, {
      label: '경험치 캐릭터 조회 오류',
      notFound: '존재하지 않는 캐릭터입니다',
      failMsg: '캐릭터 조회 실패',
    });
  }
});

export default router;
