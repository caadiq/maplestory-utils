import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expData, parseExpBonus } from '../services/exp.js';
import { parseEventSkillBonus } from '../services/character.js';
import { parseCores } from '../services/hexa.js';

test('new content and high-level rewards cover every supported level', () => {
  const park = expData.monsterPark.zones.at(-1);
  assert.equal(park.minLevel, 295);
  assert.deepEqual(park.exp, { normal: 316934208200, sunday: 475401312300, special: 1267736832800 });
  const aurum = expData.epicDungeon.dungeons.at(-1);
  assert.equal(aurum.minLevel, 290);
  assert.equal(aurum.base[290], 2174400000000);
  assert.equal(aurum.base[299], 2682000000000);
  for (const dungeon of expData.epicDungeon.dungeons) {
    for (let level = dungeon.minLevel; level < 300; level++) assert.ok(Number.isSafeInteger(dungeon.base[level]));
  }
  for (let level = 295; level < 300; level++) {
    const base = expData.epicDungeon.dungeons[0].base[level];
    assert.equal(expData.epicDungeon.dungeons[1].base[level], base * 1.5);
    assert.equal(expData.epicDungeon.dungeons[2].base[level], base * 2);
    assert.equal(aurum.base[level], base * 3);
  }
  assert.equal(expData.mvpResort.hourly[260], 347507845920);
  assert.equal(expData.sauna.hourly[260], 157362035040);
  for (let level = 200; level < 300; level++) assert.ok(expData.mvpResort.hourly[level] > expData.sauna.hourly[level]);
});
test('Arcane cost migration covers all 6 regions and 19 upgrades', () => {
  const rows = JSON.parse(readFileSync(new URL('../data/arcane-costs-2026-09-17.json', import.meta.url)));
  assert.equal(rows.length, 114);
  assert.equal(new Set(rows.map((r) => r.region)).size, 6);
  for (const row of rows) assert.equal(row.newCost, row.oldCost * 7 / 10);
});
test('overlapping event skills and artifacts are counted separately', () => {
  const effect = '몬스터파크 퇴장 시 획득하는 경험치 50% 증가\r\n아케인리버 일일퀘스트 완료 시 획득 경험치 50%, 획득 심볼 20개 증가\r\n그란디스 일일퀘스트 완료 시 획득 경험치 50%, 획득 심볼 9개 증가';
  const skills = [{ skill_name: '훈련 일지', skill_effect: effect }, { skill_name: '아르고 호의 가호', skill_effect: effect }];
  assert.equal(parseExpBonus(skills).monsterPark, 100);
  assert.equal(parseExpBonus(skills).epicDungeon, 0);
  assert.equal(parseEventSkillBonus(skills).arcane_daily, 40);
  assert.equal(parseEventSkillBonus(skills).authentic_daily, 18);
  assert.equal(parseEventSkillBonus([{ skill_name: '아르고 호의 가호', skill_effect: '' }]), null);
});
test('HEXA reset and empty API responses remain valid', () => {
  assert.deepEqual(parseCores({}, {}), []);
  assert.equal(parseCores({ character_hexa_core_equipment: [{ hexa_core_name: 'reset', hexa_core_type: '스킬 코어', hexa_core_level: 0 }] }, {})[0].level, 0);
});
