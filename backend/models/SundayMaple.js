import { DataTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

export const SundayMaple = sequelize.define('SundayMaple', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  // 해당 주의 금요일 (KST, YYYY-MM-DD)
  week_start: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  variant: {
    type: DataTypes.ENUM('normal', 'special'),
    allowNull: false,
    defaultValue: 'normal',
  },
  event_post_id: { type: DataTypes.STRING(50) },
  event_post_url: { type: DataTypes.STRING(500) },
  source_image_url: { type: DataTypes.STRING(500) },
  image_url: { type: DataTypes.STRING(500), allowNull: false },
  fetched_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'sunday_maple',
  underscored: true,
});
