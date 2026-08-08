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

// ── 심볼 이벤트 스킬 파싱 ──────────────────────────────────────
// Nexon API의 skill_level 필드는 이벤트 스킬에 한해 실제 레벨이 아닌 1로 고정되므로
// skill_effect 문자열의 심볼 증가 개수를 이용해 실제 레벨을 역산한다.
// (이벤트마다 테이블이 달라지면 아래 맵을 갱신해야 함)
const ARCANE_SYMBOL_TO_LEVEL = { 2: 1, 4: 2, 8: 3, 12: 4, 16: 5, 20: 6 };
const AUTHENTIC_SYMBOL_TO_LEVEL = { 2: 1, 3: 2, 4: 3, 5: 4, 7: 5, 9: 6 };

// 에테리온 아티팩트: '아티팩트의 힘' 스킬 효과에서 일퀘 심볼 증가량 합산.
// 게임 화면엔 %로 표시되지만 스킬 효과 텍스트엔 환산된 고정 개수로 오며,
// 코어별 줄이 모두 나열되므로(미활성 코어는 0개) 전부 더하면 된다.
const ARTIFACT_SKILL_NAME = '아티팩트의 힘';

export function parseArtifactBonus(skills) {
  const s = (skills || []).find((x) => x.skill_name === ARTIFACT_SKILL_NAME);
  if (!s) return null;
  const eff = s.skill_effect || '';
  let arcane = 0;
  let authentic = 0;
  for (const m of eff.matchAll(/아케인리버\s*일일퀘스트[^\r\n]*?획득\s*심볼\s*(\d+)\s*개/g)) {
    arcane += Number(m[1]) || 0;
  }
  for (const m of eff.matchAll(/그란디스\s*일일퀘스트[^\r\n]*?획득\s*심볼\s*(\d+)\s*개/g)) {
    authentic += Number(m[1]) || 0;
  }
  if (!arcane && !authentic) return null;
  return { arcane_daily: arcane, authentic_daily: authentic };
}

export function parseEventSkillBonus(skills) {
  for (const s of skills || []) {
    if (s.skill_name === ARTIFACT_SKILL_NAME) continue; // 아티팩트는 별도 파싱
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
