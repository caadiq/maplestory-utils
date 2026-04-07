import { DataTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nexon_uid: { type: DataTypes.STRING(50), allowNull: false, unique: true },
}, {
  tableName: 'users',
  underscored: true,
});
