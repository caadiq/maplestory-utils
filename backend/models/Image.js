import { DataTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

export const Image = sequelize.define('Image', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  path: { type: DataTypes.STRING(255), allowNull: false }, // S3 키 (예: common/abc.webp)
  width: { type: DataTypes.INTEGER },
  height: { type: DataTypes.INTEGER },
  size: { type: DataTypes.INTEGER }, // bytes
}, {
  tableName: 'images',
  underscored: true,
});
