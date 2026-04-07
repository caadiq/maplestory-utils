import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'maplestory',
  process.env.DB_USER || 'maplestory',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'mariadb',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mariadb',
    logging: false,
  }
);
