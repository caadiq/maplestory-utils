import { Op } from 'sequelize';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

// 넥슨 character/list 응답에서 계정 캐릭터 추출 (스페셜/리부트 월드 제외, 레벨 내림차순)
export function extractAccountCharacters(listData) {
  const characters = [];
  for (const acc of listData.account_list || []) {
    for (const c of acc.character_list || []) {
      const world = c.world_name || '';
      if (world.includes('스페셜') || world.includes('리부트')) continue;
      characters.push({
        ocid: c.ocid,
        character_name: c.character_name,
        world_name: world,
        job_name: c.character_class_name || c.character_class,
        character_level: c.character_level || 0,
      });
    }
  }
  characters.sort((a, b) => b.character_level - a.character_level);
  return characters;
}

// 각 캐릭터에 월드 아이콘 URL(world_icon) 부여
// ("월드 : 월드명", "월드:월드명" 등 공백 유연하게 매칭)
export async function attachWorldIcons(characters) {
  const worldNames = [...new Set(characters.map((c) => c.world_name).filter(Boolean))];
  if (!worldNames.length) return characters;
  const images = await Image.findAll({
    where: { [Op.or]: [{ name: { [Op.like]: '월드%' } }, ...worldNames.map((w) => ({ name: w }))] },
  });
  const map = {};
  for (const img of images) {
    const m = img.name.match(/^월드\s*:\s*(.+)$/);
    const k = m ? m[1].trim() : img.name.trim();
    map[k] = getPublicUrl(img.path);
  }
  return characters.map((c) => ({ ...c, world_icon: map[c.world_name] || null }));
}
