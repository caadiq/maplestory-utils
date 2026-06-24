import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// 로그인 세션. id는 랜덤 토큰(쿠키 sid 값), 만료 시각 보관.
export const Session = sequelize.define('Session', {
  id: { type: DataTypes.STRING(64), primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'sessions',
  underscored: true,
});
