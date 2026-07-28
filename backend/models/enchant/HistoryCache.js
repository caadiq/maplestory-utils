import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// 넥슨 강화 이력 일자별 캐시 — 과거 날짜 응답은 불변이므로 영구 보관
export const EnchantHistoryCache = sequelize.define('EnchantHistoryCache', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  type: { type: DataTypes.STRING(16), allowNull: false }, // starforce | cube | potential
  date: { type: DataTypes.DATEONLY, allowNull: false },
  payload: { type: DataTypes.JSON, allowNull: false },    // 해당 날짜 이력 배열
  count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'enchant_history_cache',
  underscored: true,
  indexes: [{ unique: true, fields: ['type', 'date'] }],
});
