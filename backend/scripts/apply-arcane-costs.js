// Apply the September 17 Arcane Symbol discount with transactional old-value guards.
import { readFileSync } from 'node:fs';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

const table = JSON.parse(readFileSync(new URL('../data/arcane-costs-2026-09-17.json', import.meta.url)));
const apply = process.argv.includes('--apply');
try {
  if (table.length !== 114 || new Set(table.map((r) => `${r.region}|${r.level}`)).size !== 114) {
    throw new Error('Expected 114 unique Arcane Symbol levels');
  }
  await sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query(
      "SELECT l.id, s.region, l.level, l.meso_cost FROM sym_levels l JOIN sym_symbols s ON s.id = l.symbol_id WHERE s.type = '아케인' FOR UPDATE",
      { type: QueryTypes.SELECT, transaction },
    );
    const plan = [];
    for (const entry of table) {
      const row = rows.find((r) => r.region === entry.region && r.level === entry.level);
      if (!row) throw new Error(`Missing level: ${entry.region} ${entry.level}`);
      if (!Number.isSafeInteger(entry.newCost) || entry.newCost !== entry.oldCost * 7 / 10) {
        throw new Error('Invalid 30% discount');
      }
      if (Number(row.meso_cost) === entry.newCost) continue;
      if (Number(row.meso_cost) !== entry.oldCost) throw new Error(`Unexpected cost: ${entry.region} ${entry.level}`);
      plan.push({ ...entry, id: row.id });
    }
    if (apply) {
      for (const row of plan) {
        await sequelize.query('UPDATE sym_levels SET meso_cost = ? WHERE id = ? AND meso_cost = ?', {
          replacements: [row.newCost, row.id, row.oldCost], type: QueryTypes.UPDATE, transaction,
        });
      }
    }
    console.log(`${apply ? 'Applied' : 'Dry run'}: ${plan.length} changes, ${table.length - plan.length} already applied`);
  });
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
