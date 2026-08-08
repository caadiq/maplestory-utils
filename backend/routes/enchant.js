import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/session.js';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';
import {
  TYPES, todayKST, minDateKST, fetchRange,
  fetchAccountIcons, fetchCharacterInfo, fetchIoIcon, isNormalWorld,
} from '../services/enchant.js';

const router = Router();

/** GET /api/enchant/history?type=&from=&to= (from 생략 시 전체 기간) */
router.get('/history', requireAuth, async (req, res) => {
  const { type } = req.query;
  if (!TYPES[type]) return res.status(400).json({ error: '잘못된 type' });

  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : minDateKST();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : todayKST();
  if (to < from) return res.status(400).json({ error: '기간이 잘못되었습니다' });

  try {
    const items = await fetchRange(type, from, to);
    res.json({ count: items.length, items });
  } catch (err) {
    const status = err.response?.status;
    console.error('강화 이력 조회 오류:', status, err.response?.data?.error?.message || err.message);
    if (status === 429) return res.status(429).json({ error: '넥슨 API 요청 한도 초과 — 잠시 후 다시 시도해주세요' });
    res.status(500).json({ error: '강화 이력 조회 실패' });
  }
});

/**
 * GET /api/enchant/item-icons?characters=a,b&items=x,y
 * - characters: 장착 장비 아이콘 + 월드 정보(정규 월드 여부)
 * - items: 장착 목록에 없는 아이템은 maplestory.io로 폴백 조회
 */
router.get('/item-icons', requireAuth, async (req, res) => {
  const names = (req.query.characters || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const wantedItems = (req.query.items || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 300);

  try {
    // 계정 전체 장착 사전 먼저 (넥슨 static 아이콘)
    const account = await fetchAccountIcons();
    const merged = { ...account.icons };
    const itemLevels = { ...account.levels };
    const characterWorlds = {};
    for (let i = 0; i < names.length; i += 3) {
      const chunk = names.slice(i, i + 3);
      const results = await Promise.all(chunk.map((n) => fetchCharacterInfo(n).catch(() => null)));
      results.forEach((entry, idx) => {
        if (!entry) return;
        Object.assign(merged, entry.icons);
        Object.assign(itemLevels, entry.levels || {});
        characterWorlds[chunk[idx]] = {
          world: entry.worldName,
          image: entry.characterImage,
          level: entry.characterLevel,
        };
      });
    }

    // 아이콘이 없거나 레벨을 모르는 아이템은 maplestory.io로 보강
    const needIo = wantedItems.filter((n) => !merged[n] || !itemLevels[n]);
    for (let i = 0; i < needIo.length; i += 6) {
      const chunk = needIo.slice(i, i + 6);
      const found = await Promise.all(chunk.map((n) => fetchIoIcon(n)));
      found.forEach((e, idx) => {
        const name = chunk[idx];
        if (e?.url && !merged[name]) merged[name] = e.url;
        if (e?.level && !itemLevels[name]) itemLevels[name] = e.level;
      });
    }

    const worlds = [...new Set(Object.values(characterWorlds).map((v) => v?.world).filter(Boolean))];
    const worldIconMap = {};
    if (worlds.length) {
      const images = await Image.findAll({
        where: { [Op.or]: [{ name: { [Op.like]: '월드%' } }, ...worlds.map((w) => ({ name: w }))] },
      });
      for (const img of images) {
        const m = img.name.match(/^월드\s*:\s*(.+)$/);
        worldIconMap[(m ? m[1] : img.name).trim()] = getPublicUrl(img.path);
      }
    }

    const characters = {};
    for (const [name, info] of Object.entries(characterWorlds)) {
      const world = info?.world || null;
      characters[name] = {
        world,
        worldIcon: world ? worldIconMap[world] || null : null,
        normalWorld: isNormalWorld(world),
        image: info?.image || null,
        level: info?.level ?? null,
      };
    }

    res.json({ items: merged, itemLevels, characters });
  } catch (err) {
    console.error('아이템 아이콘 조회 오류:', err.message);
    res.status(500).json({ error: '아이콘 조회 실패' });
  }
});

export default router;
