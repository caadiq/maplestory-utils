import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

export const Boss = sequelize.define('Boss', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  image_url: { type: DataTypes.STRING(255) },
}, {
  tableName: 'bosses',
  underscored: true,
});
