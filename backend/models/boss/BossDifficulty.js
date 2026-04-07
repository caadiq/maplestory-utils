import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

export const BossDifficulty = sequelize.define('BossDifficulty', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  boss_id: { type: DataTypes.INTEGER, allowNull: false },
  difficulty: { type: DataTypes.ENUM('easy', 'normal', 'hard', 'chaos', 'extreme'), allowNull: false },
  crystal_price: { type: DataTypes.BIGINT, allowNull: false },
  required_level: { type: DataTypes.INTEGER, defaultValue: 0 },
  max_party_size: { type: DataTypes.TINYINT, defaultValue: 1 },
}, {
  tableName: 'boss_difficulties',
  underscored: true,
  timestamps: false,
  indexes: [
    { unique: true, fields: ['boss_id', 'difficulty'] },
  ],
});
