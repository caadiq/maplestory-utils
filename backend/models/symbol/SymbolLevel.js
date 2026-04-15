import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

export const SymbolLevel = sequelize.define('SymbolLevel', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  symbol_id: { type: DataTypes.INTEGER, allowNull: false },
  level: { type: DataTypes.TINYINT, allowNull: false },
  required_count: { type: DataTypes.SMALLINT, allowNull: false },
  meso_cost: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'sym_levels',
  underscored: true,
  indexes: [
    { unique: true, fields: ['symbol_id', 'level'] },
  ],
});
