/**
 * 결정석 판매 가격 일괄 변경.
 *
 * 넥슨 공지의 변경 표를 그대로 옮긴 것이고, 실행 전에 **기존 가격이 DB 값과 같은지**
 * 한 행씩 확인한다. 하나라도 어긋나면 아무것도 쓰지 않고 멈춘다 —
 * 공지의 '기존 가격'과 우리 값이 다르면 둘 중 하나가 틀렸다는 뜻이라
 * 그대로 덮어쓰면 조용히 잘못된 값이 들어간다.
 *
 * 어긋났을 때는 **우리 값을 먼저 바로잡고 다시 돌린다**. 예외 필드를 둬서 통과시키면
 * 가드가 있으나 마나다 (실제로 벨로나 노멀에서 그렇게 했다가 되돌렸다).
 *
 *   node scripts/apply-crystal-prices.js <표.json>          # 확인만
 *   node scripts/apply-crystal-prices.js <표.json> --apply   # 실제 반영
 *
 * 표 형식: [{ boss, difficulty, oldPrice, newPrice }, ...]
 */
import { readFileSync } from 'fs';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

const [, , file, flag] = process.argv;
if (!file) { console.error('사용법: node scripts/apply-crystal-prices.js <표.json> [--apply]'); process.exit(1); }
const apply = flag === '--apply';
const table = JSON.parse(readFileSync(file, 'utf8'));

// mariadb 드라이버에서 구조분해가 깨져서 SELECT 타입을 명시한다
const cur = await sequelize.query(
  'SELECT b.name, d.id, d.difficulty, d.crystal_price FROM bc_bosses b JOIN bc_boss_difficulties d ON d.boss_id = b.id',
  { type: QueryTypes.SELECT },
);
const byKey = new Map(cur.map((r) => [`${r.name}|${r.difficulty}`, r]));

const plan = [];
const problems = [];
const done = [];
for (const row of table) {
  const key = `${row.boss}|${row.difficulty}`;
  const db = byKey.get(key);
  if (!db) { problems.push(`${key} — DB에 없는 보스`); continue; }
  const price = Number(db.crystal_price);

  // 이미 반영된 행을 먼저 걸러낸다. 이걸 뒤에 두면 재실행할 때마다
  // 바뀐 값이 '기존 가격 불일치'로 잡혀 멀쩡한 행이 전부 문제로 보고된다.
  if (price === row.newPrice) { done.push(key); continue; }

  if (price !== row.oldPrice) {
    problems.push(`${key} — 기존 가격 불일치 (DB ${price.toLocaleString()} / 공지 ${row.oldPrice.toLocaleString()})`);
    continue;
  }
  plan.push({ id: db.id, key, from: price, to: row.newPrice });
}

console.log(`표 ${table.length}행 · 바꿀 것 ${plan.length}행 · 이미 반영됨 ${done.length}행 · 문제 ${problems.length}건\n`);
for (const p of plan) {
  const pct = ((p.to / p.from - 1) * 100).toFixed(1);
  console.log(`  ${p.key.padEnd(28)} ${p.from.toLocaleString().padStart(15)} → ${p.to.toLocaleString().padStart(15)}  (${pct}%)`);
}
if (problems.length) {
  console.log('\n문제:');
  for (const p of problems) console.log(`  ${p}`);
}

if (!apply) {
  console.log('\n확인만 했습니다. 실제로 반영하려면 --apply 를 붙이세요.');
} else if (problems.length) {
  console.log('\n문제가 있어 아무것도 반영하지 않았습니다.');
  process.exitCode = 1;
} else {
  await sequelize.transaction(async (tx) => {
    for (const p of plan) {
      await sequelize.query('UPDATE bc_boss_difficulties SET crystal_price = ? WHERE id = ?',
        { replacements: [p.to, p.id], transaction: tx, type: QueryTypes.UPDATE });
    }
  });
  console.log(`\n${plan.length}행 반영 완료.`);
}
await sequelize.close();
