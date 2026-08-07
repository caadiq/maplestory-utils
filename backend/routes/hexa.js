import { Router } from 'express';
import axios from 'axios';
import { attachWorldIcons } from '../services/character.js';

const router = Router();
const NEXON_API_BASE = 'https://open.api.nexon.com';

const nexon = (path, params) => axios.get(`${NEXON_API_BASE}${path}`, {
  params,
  headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
  timeout: 10000,
});

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
    const { data: idData } = await nexon('/maplestory/v1/id', { character_name: name });
    const ocid = idData.ocid;

    const [{ data: basic }, { data: hexa }, { data: skill6 }] = await Promise.all([
      nexon('/maplestory/v1/character/basic', { ocid }),
      nexon('/maplestory/v1/character/hexamatrix', { ocid }),
      nexon('/maplestory/v1/character/skill', { ocid, character_skill_grade: 6 }),
    ]);

    const iconBySkill = new Map(
      (skill6.character_skill || []).map((s) => [s.skill_name, s.skill_icon]),
    );

    /*
     * 아이콘 후보를 넓게 시도한다. 코어에 따라 이름 규칙이 제각각이다 —
     * 렌의 "창룡파천검 : 일매낙화 천비인적"은 linked_skill이 "…-낙화/-진천/-천강"으로
     * 갈라져 있는데 6차 스킬 목록에는 코어명 그대로만 있다.
     */
    const findIcon = (c) => {
      const candidates = [c.hexa_core_name];
      for (const l of c.linked_skill || []) {
        const id = l.hexa_skill_id || '';
        candidates.push(id, `${id} VI`, id.replace(/-[^-]*$/, ''));
      }
      for (const name of candidates) {
        const icon = iconBySkill.get(name);
        if (icon) return icon;
      }
      return null;
    };

    const cores = (hexa.character_hexa_core_equipment || []).map((c) => ({
      name: c.hexa_core_name,
      type: c.hexa_core_type,             // 스킬 코어 | 마스터리 코어 | 강화 코어 | 공용 코어
      level: c.hexa_core_level,
      icon: findIcon(c),
    }));

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
    const code = err.response?.data?.error?.name;
    if (['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'].includes(code)) {
      return res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    }
    if (err.response?.status === 400) {
      return res.status(404).json({ error: '존재하지 않는 캐릭터입니다' });
    }
    console.error('헥사 조회 오류:', err.response?.data || err.message);
    res.status(500).json({ error: '헥사 정보 조회 실패' });
  }
});

export default router;
