import { Router } from 'express';
import { getOcid, nexonGet, handleNexonError } from '../lib/nexon.js';
import { attachWorldIcons } from '../services/character.js';
import { expData, loadIcons, fetchHistory } from '../services/exp.js';

const router = Router();

router.get('/data', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ ...expData, icons: await loadIcons() });
  } catch (err) {
    console.error('경험치 데이터 조회 오류:', err.message);
    res.status(500).json({ error: '데이터 조회 실패' });
  }
});

/**
 * 캐릭터 조회 — 레벨·현재 경험치%·경험치 히스토리까지 한 번에.
 * 캐릭터 정보는 넥슨 API 특성상 전일 기준.
 */
router.get('/lookup', async (req, res) => {
  const name = req.query.name?.trim();
  if (!name) return res.status(400).json({ error: '캐릭터 닉네임을 입력해주세요' });

  try {
    const ocid = await getOcid(name);

    const [{ data: basic }, history] = await Promise.all([
      nexonGet('/maplestory/v1/character/basic', { ocid }),
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
      guild_name: basic.character_guild_name || null,
      date_create: basic.character_date_create || null,
      history,
    });
  } catch (err) {
    handleNexonError(err, res, { label: '경험치 캐릭터 조회 오류', notFound: '존재하지 않는 캐릭터입니다', failMsg: '캐릭터 조회 실패' });
  }
});

export default router;
