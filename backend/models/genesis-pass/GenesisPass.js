import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

// 제네시스 패스 시즌 설정 (단일 행). 해방 계산기의 포인트 배수/적용 기간을 운영자가 관리.
export const GenesisPass = sequelize.define('GenesisPass', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: true }, // 효과 시작일 (YYYY-MM-DD)
  end_date: { type: DataTypes.DATEONLY, allowNull: true },   // 효과 종료일 (YYYY-MM-DD)
  multiplier: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 3 }, // 포인트 배수
  image_id: { type: DataTypes.INTEGER, allowNull: true }, // images 테이블 참조
}, {
  tableName: 'genesis_pass',
  underscored: true,
});
