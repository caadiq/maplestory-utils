import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

export const Symbol = sequelize.define('Symbol', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  type: {
    type: DataTypes.ENUM('아케인', '어센틱', '그랜드 어센틱'),
    allowNull: false,
  },
  region: { type: DataTypes.STRING(32), allowNull: false },
  image: { type: DataTypes.STRING(255), allowNull: true },
  max_level: { type: DataTypes.TINYINT, allowNull: false },
  daily_default: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
  weekly_default: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'sym_symbols',
  underscored: true,
  indexes: [
    { unique: true, fields: ['type', 'region'] },
    { fields: ['sort_order'] },
  ],
});
