import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// feature별 사용자 데이터(계산기 상태)를 JSON으로 통째 저장. 사용자×feature 당 1행.
export const UserState = sequelize.define('UserState', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  feature: { type: DataTypes.ENUM('boss-crystal', 'symbol', 'liberation', 'hexa-matrix', 'exp-calculator'), allowNull: false },
  payload: { type: DataTypes.JSON, allowNull: false },
}, {
  tableName: 'user_states',
  underscored: true,
  indexes: [{ unique: true, fields: ['user_id', 'feature'] }],
});
