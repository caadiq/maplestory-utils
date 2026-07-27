import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

export const BossCrystalBoss = sequelize.define('BossCrystalBoss', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  image_path: { type: DataTypes.STRING(255), allowNull: true }, // S3 키 (예: crystal/boss/검은마법사.webp)
  max_party_size: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 6 },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  // 챌린저스 시즌보스면 해당 시즌 id (메소 드랍 — 결정석 한도 미포함), 일반 보스는 null
  season_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'bc_bosses',
  underscored: true,
  indexes: [{ fields: ['sort_order'] }],
});
