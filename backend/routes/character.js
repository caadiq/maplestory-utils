import { Router } from 'express';
import axios from 'axios';

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

    res.json({
      ocid: idData.ocid,
      character_name: basic.character_name,
      world_name: basic.world_name,
      job_name: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
    });
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

// OCID로 장착 심볼 조회
router.get('/symbols', async (req, res) => {
  const { ocid } = req.query;
  if (!ocid) return res.status(400).json({ error: 'ocid가 필요합니다' });

  try {
    const { data } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/character/symbol-equipment`, {
      params: { ocid },
      headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
    });

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

    res.json({ ocid, character_class: data.character_class, symbols: parsed });
  } catch (err) {
    const code = err.response?.data?.error?.name;
    if (['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'].includes(code)) {
      return res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    }
    console.error('심볼 조회 오류:', err.response?.data || err.message);
    res.status(500).json({ error: '심볼 조회 실패' });
  }
});

export default router;
