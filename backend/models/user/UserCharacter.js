import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// 로그인 시 동기화하는 계정 캐릭터 캐시 (캐릭터 자동완성용).
export const UserCharacter = sequelize.define('UserCharacter', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  ocid: { type: DataTypes.STRING(64), allowNull: false },
  character_name: { type: DataTypes.STRING(32), allowNull: false },
  world_name: { type: DataTypes.STRING(32), allowNull: true },
  job_name: { type: DataTypes.STRING(64), allowNull: true },
  character_level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'user_characters',
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id', 'ocid'] },
    { fields: ['user_id', 'character_level'] },
  ],
});
