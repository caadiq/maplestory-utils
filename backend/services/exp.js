import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';
import { nexonGet } from '../lib/nexon.js';

// 경험치 데이터 (레벨 테이블·컨텐츠별 정수) — 서버 기동 시 1회 로드
const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/exp-data.json');
export const expData = JSON.parse(readFileSync(dataPath, 'utf-8'));

const ICON_NAMES = {
  arc_yeoro: '아케인심볼 : 소멸의 여로',
  arc_chewchew: '아케인심볼 : 츄츄 아일랜드',
  arc_lacheln: '아케인심볼 : 레헬른',
  arc_arcana: '아케인심볼 : 아르카나',
  arc_morass: '아케인심볼 : 모라스',
  arc_esfera: '아케인심볼 : 에스페라',
  /* 테네브리스는 심볼이 아니라 염원의 불꽃을 준다 — 세 지역이 같은 그림을 쓴다 */
  flame: '염원의 불꽃',
  ten_moonbridge: '지역 : 문브릿지',
  ten_maze: '지역 : 고통의 미궁',
  ten_limen: '지역 : 리멘',
  mp_sellas: '지역 : 셀라스',
  gra_cernium: '어센틱심볼 : 세르니움',
  gra_arcs: '어센틱심볼 : 아르크스',
  gra_odium: '어센틱심볼 : 오디움',
  gra_dowonkyung: '어센틱심볼 : 도원경',
  gra_arteria: '어센틱심볼 : 아르테리아',
  gra_carcion: '어센틱심볼 : 카르시온',
  gra_tallahart: '그랜드 어센틱심볼 : 탈라하트',
  gra_geardrak: '그랜드 어센틱심볼 : 기어드락',
  hunt: '정령의 펜던트',
  mp: '몬스터파크 이용권',
  mp_extreme: '익스트림 몬스터파크',
  ed_highmountain: '에픽던전 : 하이마운틴',
  ed_angler: '에픽던전 : 앵글러 컴퍼니',
  ed_nightmare: '에픽던전 : 악몽선경',
  elixir: '성장의 비약',
  elixir_e249: '성장의 비약 (200~249)',
  elixir_e259: '성장의 비약 (200~259)',
  elixir_e269: '성장의 비약 (200~269)',
  elixir_e279: '성장의 비약 (200~279)',
  elixir200: '200레벨 달성의 비약',
  elixir250: '250레벨 달성의 비약',
  coupon: 'EXP 교환권',
  coupon_up: '상급 EXP 교환권',
  sauna: 'MVP 리조트',
  sauna_vip: 'VIP 사우나',
  farm_gold: '황금 딸기 농장',
  farm_blue: '블루베리 농장',
  farm_mech: '메카베리 농장',
  farm_crimson: '크림슨 메카베리 농장',

  /* 몬스터파크 드롭다운 — 심볼이 아니라 지역 그림을 쓴다 */
  region_yeoro: '지역 : 소멸의 여로',
  region_chewchew: '지역 : 츄츄 아일랜드',
  region_lacheln: '지역 : 꿈의 도시 레헬른',
  region_arcana: '지역 : 신비의 숲 아르카나',
  region_morass: '지역 : 기억의 늪 모라스',
  region_esfera: '지역 : 태초의 바다 에스페라',
  region_sellas: '지역 : 셀라스, 별이 잠긴 곳',
  region_moonbridge: '지역 : 문브릿지',
  region_maze: '지역 : 고통의 미궁',
  region_limen: '지역 : 리멘',
  region_cernium: '지역 : 세르니움',
  region_arcs: '지역 : 호텔 아르크스',
  region_odium: '지역 : 오디움',
  region_dowonkyung: '지역 : 도원경',
  region_arteria: '지역 : 아르테리아',
  region_carcion: '지역 : 카르시온',
  region_tallahart: '지역 : 탈라하트',
};

// 이름→URL은 거의 안 바뀌므로 한 번 조회해 캐시한다.
// 관리자가 이미지를 올리면 그 이름이 새로 잡혀야 하므로 업로드·삭제 시 비운다.
let iconCache = null;
export function resetIconCache() {
  iconCache = null;
}
export async function loadIcons() {
  if (iconCache) return iconCache;
  const rows = await Image.findAll({ where: { name: Object.values(ICON_NAMES) } });
  const urlByName = Object.fromEntries(rows.map((r) => [r.name, getPublicUrl(r.path)]));
  iconCache = Object.fromEntries(
    Object.entries(ICON_NAMES)
      .map(([slug, name]) => [slug, urlByName[name]])
      .filter(([, url]) => url),
  );
  return iconCache;
}

/**
 * 캐릭터가 받고 있는 컨텐츠별 경험치 보너스(%)를 스킬 효과 텍스트에서 읽는다.
 *
 * 보약(훈련 일지)은 서버마다 찍은 단계가 달라 값이 제각각이고, 아티팩트도 코어 구성에 따라
 * 다르다. 그래서 고정값으로 둘 수 없고 캐릭터마다 읽어야 한다.
 *
 * 효과 텍스트에는 같은 항목이 여러 줄로 나뉘어 오므로(코어별로 한 줄씩) 전부 더한다.
 * 실측 예: "몬스터파크 퇴장 시 획득하는 경험치 30% 증가" + "… 15% 증가" → 45%
 */
const BONUS_PATTERNS = {
  monsterPark: /몬스터파크\s*퇴장\s*시\s*획득하는\s*경험치\s*([\d.]+)%\s*증가/g,
  epicDungeon: /에픽\s*던전\s*기본\s*경험치\s*보상\s*획득량\s*([\d.]+)%\s*증가/g,
  arcaneDaily: /아케인리버\s*일일퀘스트\s*완료\s*시\s*획득\s*경험치\s*([\d.]+)%/g,
  grandisDaily: /그란디스\s*일일퀘스트\s*완료\s*시\s*획득\s*경험치\s*([\d.]+)%/g,
  /** 사냥으로 얻는 경험치에만 붙는다 — 이 계산기의 항목(컨텐츠·아이템)에는 적용하지 않고 참고로만 보여준다 */
  hunting: /(?<!퇴장 시 획득하는 )경험치\s*획득량\s*([\d.]+)%\s*증가/g,
};

export function parseExpBonus(skills) {
  const total = { monsterPark: 0, epicDungeon: 0, arcaneDaily: 0, grandisDaily: 0, hunting: 0 };
  const sources = [];

  for (const s of skills || []) {
    const eff = s.skill_effect || '';
    const found = {};
    for (const [key, re] of Object.entries(BONUS_PATTERNS)) {
      let sum = 0;
      for (const m of eff.matchAll(re)) sum += Number(m[1]) || 0;
      if (sum > 0) {
        found[key] = sum;
        total[key] += sum;
      }
    }
    if (Object.keys(found).length) sources.push({ skill_name: s.skill_name, ...found });
  }

  return sources.length ? { ...total, sources } : null;
}

/**
 * 일자별 경험치 히스토리 — 랭킹 API가 과거 날짜의 레벨·레벨 내 경험치(절대값)를 준다.
 * 성장 추이 차트용. 과거 값은 불변이라 메모리에 캐시한다.
 */
const historyCache = new Map(); // `${ocid}:${date}` -> { level, exp } | null(데이터 없음)

function kstDateStr(daysAgo) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 - daysAgo * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function fetchHistory(ocid, days = 9) {
  const dates = Array.from({ length: days }, (_, i) => kstDateStr(days - i)); // 과거 → 어제
  const rows = await Promise.all(dates.map(async (date) => {
    const key = `${ocid}:${date}`;
    if (historyCache.has(key)) return { date, ...historyCache.get(key) || {} };
    try {
      const { data } = await nexonGet('/maplestory/v1/ranking/overall', { date, ocid });
      const r = data.ranking?.[0];
      const v = r ? { level: r.character_level, exp: Number(r.character_exp) } : null;
      if (historyCache.size > 20000) historyCache.clear();
      historyCache.set(key, v);
      return { date, ...(v || {}) };
    } catch {
      return { date };
    }
  }));
  return rows.filter((r) => r.level != null).map((r) => ({
    date: r.date,
    level: r.level,
    exp_rate: expData.levelExp[String(r.level)]
      ? Math.round((r.exp / expData.levelExp[String(r.level)]) * 100000) / 1000
      : 0,
  }));
}
