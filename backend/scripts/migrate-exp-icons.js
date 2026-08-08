/**
 * 경험치 계산기 아이콘을 S3(rustfs)로 올리고 images 테이블에 등록한다.
 *
 * 프런트 번들에 PNG를 넣어두면 사이트의 다른 이미지(심볼·큐브 등)와 관리 방식이 갈리고,
 * 아이콘을 바꿀 때마다 재빌드가 필요하다. 이름만 맞춰두면 관리자 페이지에서 교체할 수 있다.
 *
 *   docker compose exec backend node scripts/migrate-exp-icons.js <아이콘폴더>
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Image } from '../models/index.js';
import { uploadObject, getPublicUrl } from '../lib/s3.js';

/** 파일명(슬러그) → images 테이블에 쓸 이름. 기존 명명 규칙("아케인심볼 : 소멸의 여로")을 따른다 */
const NAMES = {
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

const dir = process.argv[2];
if (!dir) {
  console.error('사용법: node scripts/migrate-exp-icons.js <아이콘폴더>');
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
const missing = files.map((f) => f.replace(/\.png$/, '')).filter((s) => !NAMES[s]);
if (missing.length) {
  console.error('이름이 정의되지 않은 슬러그:', missing.join(', '));
  process.exit(1);
}

let created = 0;
let reused = 0;
for (const file of files.sort()) {
  const slug = file.replace(/\.png$/, '');
  const name = NAMES[slug];
  const buf = readFileSync(path.join(dir, file));
  const { width, height } = await sharp(buf).metadata();

  const existing = await Image.findOne({ where: { name } });
  if (existing) {
    reused += 1;
    console.log(`= ${name}  (이미 등록됨)`);
    continue;
  }
  const key = `exp/${slug}.png`;
  await uploadObject(key, buf, 'image/png');
  await Image.create({ name, path: key, width, height, size: buf.length });
  created += 1;
  console.log(`+ ${name}  ${getPublicUrl(key)}`);
}
console.log(`\n완료 — 신규 ${created}개, 기존 재사용 ${reused}개`);
process.exit(0);
