import { Router } from 'express';
import {
  attachWorldIcons, extractAccountCharacters, parseArtifactBonus, parseEventSkillBonus,
} from '../services/character.js';
import { nexonGet, getOcid, handleNexonError } from '../lib/nexon.js';

const router = Router();

// 캐릭터 닉네임으로 정보 조회
router.get('/search', async (req, res) => {
  const { name } = req.query;
  if (!name?.trim()) return res.status(400).json({ error: '캐릭터 닉네임을 입력해주세요' });

  try {
    const ocid = await getOcid(name.trim());
    const { data: basic } = await nexonGet('/maplestory/v1/character/basic', { ocid });

    const [character] = await attachWorldIcons([{
      ocid,
      character_name: basic.character_name,
      world_name: basic.world_name,
      job_name: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
    }]);
    res.json(character);
  } catch (err) {
    handleNexonError(err, res, { label: '캐릭터 조회 오류', notFound: '존재하지 않는 캐릭터입니다', failMsg: '캐릭터 조회 실패' });
  }
});

// 이벤트 스킬(보약) 효과에서 일퀘 심볼 보너스 파싱
// OCID로 장착 심볼 + 이벤트 스킬 보너스 조회
router.get('/symbols', async (req, res) => {
  const { ocid } = req.query;
  if (!ocid) return res.status(400).json({ error: 'ocid가 필요합니다' });

  try {
    const [symbolRes, skillRes, schedRes] = await Promise.all([
      nexonGet('/maplestory/v1/character/symbol-equipment', { ocid }),
      nexonGet('/maplestory/v1/character/skill', { ocid, character_skill_grade: '0' })
        .catch(() => ({ data: { character_skill: [] } })),
      // 스케줄러: API 키 소유 계정의 캐릭터만 조회 가능 → 실패하면 null (일퀘 자동 체크 생략)
      nexonGet('/maplestory/v1/scheduler/character-state', { ocid }).catch(() => null),
    ]);
    const data = symbolRes.data;

    const parsed = (data.symbol || []).map((s) => {
      const [prefix, region] = (s.symbol_name || '').split(' : ').map((t) => t.trim());
      const type = prefix?.replace(/심볼$/, '').trim(); // '아케인심볼' → '아케인'
      return {
        type,
        region,
        level: Number(s.symbol_level) || 0,
        force: Number(s.symbol_force) || 0,
        growth_count: Number(s.symbol_growth_count) || 0,
        require_growth_count: Number(s.symbol_require_growth_count) || 0,
      };
    });

    const event_skill = parseEventSkillBonus(skillRes.data?.character_skill);
    const artifact = parseArtifactBonus(skillRes.data?.character_skill);

    // 스케줄러 일일 퀘스트 상태 (quest_state "2"=완료). 조회 불가 시 null
    const daily_quests = schedRes?.data?.daily_contents
      ? schedRes.data.daily_contents
          .filter((c) => c.type === 'quest')
          .map((c) => ({ name: c.content_name, state: c.quest_state }))
      : null;

    res.json({ ocid, character_class: data.character_class, symbols: parsed, event_skill, artifact, daily_quests });
  } catch (err) {
    handleNexonError(err, res, { label: '심볼 조회 오류', failMsg: '심볼 조회 실패' });
  }
});

// API 키로 캐릭터 목록 조회 (사용자 제공 키 사용)
router.get('/list', async (req, res) => {
  const key = req.header('x-user-api-key');
  if (!key) return res.status(400).json({ error: 'API 키가 필요합니다' });

  try {
    const { data } = await nexonGet('/maplestory/v1/character/list', null, { apiKey: key });
    const characters = await attachWorldIcons(extractAccountCharacters(data));
    res.json({ characters });
  } catch (err) {
    const code = err.response?.data?.error?.name;
    if (err.response?.status === 401 || err.response?.status === 403 || code === 'OPENAPI00004') {
      return res.status(401).json({ error: '유효하지 않은 API 키입니다' });
    }
    handleNexonError(err, res, { label: '캐릭터 목록 조회 오류', failMsg: '캐릭터 목록 조회 실패' });
  }
});

export default router;
