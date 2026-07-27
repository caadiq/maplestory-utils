import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// 챌린저스 월드 시즌 (기간 내에만 해당 시즌의 시즌보스가 노출됨)
export const ChallengerSeason = sequelize.define('ChallengerSeason', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  season_number: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
}, {
  tableName: 'bc_challenger_seasons',
  underscored: true,
});
