import { Router } from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';
import { attachWorldIcons } from '../services/character.js';

const router = Router();
const NEXON_API_BASE = 'https://open.api.nexon.com';

// 캐릭터 닉네임으로 정보 조회
router.get('/search', async (req, res) => {
  const { name } = req.query;
  if (!name?.trim()) return res.status(400).json({ error: '캐릭터 닉네임을 입력해주세요' });

  try {
    // 1) ocid 조회
    const { data: idData } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/id`, {
      params: { character_name: name.trim() },
      headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
    });

    // 2) basic 조회
    const { data: basic } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/character/basic`, {
      params: { ocid: idData.ocid },
      headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
    });

    const [character] = await attachWorldIcons([{
      ocid: idData.ocid,
      character_name: basic.character_name,
      world_name: basic.world_name,
      job_name: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
    }]);
    res.json(character);
  } catch (err) {
    const code = err.response?.data?.error?.name;
    if (['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'].includes(code)) {
      return res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    }
    if (err.response?.status === 400) {
      return res.status(404).json({ error: '존재하지 않는 캐릭터입니다' });
    }
    console.error('캐릭터 조회 오류:', err.response?.data || err.message);
    res.status(500).json({ error: '캐릭터 조회 실패' });
  }
});

// 이벤트 스킬(보약) 효과에서 일퀘 심볼 보너스 파싱
// Nexon API의 skill_level 필드는 이벤트 스킬에 한해 실제 레벨이 아닌 1로 고정되므로
// skill_effect 문자열의 심볼 증가 개수를 이용해 실제 레벨을 역산한다.
// (이벤트마다 테이블이 달라지면 아래 맵을 갱신해야 함)
const ARCANE_SYMBOL_TO_LEVEL = { 2: 1, 4: 2, 8: 3, 12: 4, 16: 5, 20: 6 };
const AUTHENTIC_SYMBOL_TO_LEVEL = { 2: 1, 3: 2, 4: 3, 5: 4, 7: 5, 9: 6 };

function parseEventSkillBonus(skills) {
  for (const s of skills || []) {
    const eff = s.skill_effect || '';
    const arcane = eff.match(/아케인리버\s*일일퀘스트[^\r\n]*?획득\s*심볼\s*(\d+)\s*개/);
    const authentic = eff.match(/그란디스\s*일일퀘스트[^\r\n]*?획득\s*심볼\s*(\d+)\s*개/);
    if (arcane || authentic) {
      const arcaneDaily = arcane ? Number(arcane[1]) || 0 : 0;
      const authenticDaily = authentic ? Number(authentic[1]) || 0 : 0;
      const derivedLevel =
        AUTHENTIC_SYMBOL_TO_LEVEL[authenticDaily] ||
        ARCANE_SYMBOL_TO_LEVEL[arcaneDaily] ||
        0;
      return {
        skill_name: s.skill_name,
        skill_level: derivedLevel,
        arcane_daily: arcaneDaily,
        authentic_daily: authenticDaily,
      };
    }
  }
  return null;
}

// OCID로 장착 심볼 + 이벤트 스킬 보너스 조회
router.get('/symbols', async (req, res) => {
  const { ocid } = req.query;
  if (!ocid) return res.status(400).json({ error: 'ocid가 필요합니다' });

  try {
    const [symbolRes, skillRes] = await Promise.all([
      axios.get(`${NEXON_API_BASE}/maplestory/v1/character/symbol-equipment`, {
        params: { ocid },
        headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
      }),
      axios.get(`${NEXON_API_BASE}/maplestory/v1/character/skill`, {
        params: { ocid, character_skill_grade: '0' },
        headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
      }).catch(() => ({ data: { character_skill: [] } })),
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

    res.json({ ocid, character_class: data.character_class, symbols: parsed, event_skill });
  } catch (err) {
    const code = err.response?.data?.error?.name;
    if (['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'].includes(code)) {
      return res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    }
    console.error('심볼 조회 오류:', err.response?.data || err.message);
    res.status(500).json({ error: '심볼 조회 실패' });
  }
});

// API 키로 캐릭터 목록 조회 (사용자 제공 키 사용)
router.get('/list', async (req, res) => {
  const key = req.header('x-user-api-key');
  if (!key) return res.status(400).json({ error: 'API 키가 필요합니다' });

  try {
    const { data } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/character/list`, {
      headers: { 'x-nxopen-api-key': key },
    });

    // 계정별 캐릭터를 하나로 합치고 월드 필터링 (스페셜/리부트 제외)
    const characters = [];
    for (const acc of data.account_list || []) {
      for (const c of acc.character_list || []) {
        const world = c.world_name || '';
        if (world.includes('스페셜') || world.includes('리부트')) continue;
        characters.push({
          ocid: c.ocid,
          character_name: c.character_name,
          world_name: world,
          job_name: c.character_class_name || c.character_class,
          character_level: c.character_level,
        });
      }
    }

    characters.sort((a, b) => (b.character_level || 0) - (a.character_level || 0));

    // 월드 아이콘 매핑 ("월드 : 월드명", "월드:월드명" 등 공백 유연하게 매칭)
    const worldNames = [...new Set(characters.map((c) => c.world_name).filter(Boolean))];
    if (worldNames.length) {
      const images = await Image.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: '월드%' } },
            ...worldNames.map((w) => ({ name: w })),
          ],
        },
      });
      const worldIconMap = {};
      for (const img of images) {
        const m = img.name.match(/^월드\s*:\s*(.+)$/);
        const key = m ? m[1].trim() : img.name.trim();
        worldIconMap[key] = getPublicUrl(img.path);
      }
      for (const c of characters) {
        c.world_icon = worldIconMap[c.world_name] || null;
      }
    }

    res.json({ characters });
  } catch (err) {
    const code = err.response?.data?.error?.name;
    if (['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'].includes(code)) {
      return res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    }
    if (err.response?.status === 401 || err.response?.status === 403 || code === 'OPENAPI00004') {
      return res.status(401).json({ error: '유효하지 않은 API 키입니다' });
    }
    console.error('캐릭터 목록 조회 오류:', err.response?.data || err.message);
    res.status(500).json({ error: '캐릭터 목록 조회 실패' });
  }
});

export default router;
