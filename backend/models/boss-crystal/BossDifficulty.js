import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';
import { DIFFICULTIES } from '../../constants.js';

export const BossCrystalBossDifficulty = sequelize.define('BossCrystalBossDifficulty', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  boss_id: { type: DataTypes.INTEGER, allowNull: false },
  difficulty: {
    type: DataTypes.ENUM(...DIFFICULTIES),
    allowNull: false,
  },
  crystal_price: { type: DataTypes.BIGINT, allowNull: false },
}, {
  tableName: 'bc_boss_difficulties',
  underscored: true,
  timestamps: false,
  indexes: [
    { unique: true, fields: ['boss_id', 'difficulty'] },
  ],
});
