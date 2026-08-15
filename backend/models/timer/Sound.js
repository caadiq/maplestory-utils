import { DataTypes } from 'sequelize';
import { sequelize } from '../../lib/db.js';

/**
 * 재획 타이머 알림음.
 *
 * 예전에는 프론트엔드 번들에 파일을 넣어 두고 폴더를 훑었다 — 음원을 하나 추가하려면
 * 코드를 고치고 다시 빌드해야 했다. 이미지처럼 RustFS에 올리고 DB로 관리한다.
 *
 * key  : 사용자 설정에 저장되는 값. 파일을 교체하거나 이름을 바꿔도 고른 소리가 유지되도록
 *        별도로 둔다 (번들 시절의 파일명을 그대로 옮겨와 기존 설정도 그대로 맞는다).
 * kind : 'alarm'(효과음) | 'tts'(음성). 드롭다운에서 구분해 보여준다.
 */
export const TimerSound = sequelize.define('TimerSound', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  key: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  kind: { type: DataTypes.ENUM('alarm', 'tts'), allowNull: false, defaultValue: 'alarm' },
  path: { type: DataTypes.STRING(255), allowNull: false }, // S3 키 (예: timer-sounds/abc.mp3)
  size: { type: DataTypes.INTEGER },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'timer_sounds',
  underscored: true,
});
