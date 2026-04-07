import { DataTypes } from 'sequelize';
import { sequelize } from '../lib/db.js';

export const UserCharacter = sequelize.define('UserCharacter', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  character_name: { type: DataTypes.STRING(50), allowNull: false },
  ocid: { type: DataTypes.STRING(100) },
  world_name: { type: DataTypes.STRING(20) },
  job_name: { type: DataTypes.STRING(50) },
  character_level: { type: DataTypes.INTEGER },
  character_image: { type: DataTypes.STRING(255) },
}, {
  tableName: 'user_characters',
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id', 'character_name'] },
  ],
});
