import { Router } from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

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
