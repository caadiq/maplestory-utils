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
};

// 이름→URL은 거의 안 바뀌므로 한 번 조회해 캐시한다
let iconCache = null;
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
 * 일자별 경험치 히스토리 — 랭킹 API가 과거 날짜의 레벨·레벨 내 경험치(절대값)를 준다.
 * 과거 값은 불변이라 메모리에 캐시한다.
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
