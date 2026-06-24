import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// 사용자 계정. 넥슨 계정의 대표 캐릭터 ocid로 식별 (닉네임 변경에 안정적).
export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ocid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  nickname: { type: DataTypes.STRING(32), allowNull: false }, // 로그인 시점 대표 닉네임 (표시용)
  is_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'users',
  underscored: true,
});
