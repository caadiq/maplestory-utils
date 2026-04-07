import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

export const UserBossSelection = sequelize.define('UserBossSelection', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  user_character_id: { type: DataTypes.INTEGER, allowNull: false },
  boss_difficulty_id: { type: DataTypes.INTEGER, allowNull: false },
  party_size: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'user_boss_selections',
  underscored: true,
  timestamps: false,
  indexes: [
    { unique: true, fields: ['user_character_id', 'boss_difficulty_id'] },
  ],
});
