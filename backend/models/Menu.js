import { DataTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

export const Menu = sequelize.define('Menu', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(255) },
  url: { type: DataTypes.STRING(255), allowNull: false },
  image_id: { type: DataTypes.INTEGER, allowNull: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'menus',
  underscored: true,
  indexes: [{ fields: ['sort_order'] }],
});
