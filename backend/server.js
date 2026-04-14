import express from 'express';
import cors from 'cors';
import adminRoutes from './routes/admin.js';
import menuRoutes from './routes/menus.js';
import noticeRoutes from './routes/notices.js';
import bossCrystalRoutes from './routes/boss-crystal.js';
import characterRoutes from './routes/character.js';
import imageRoutes from './routes/images.js';
import { sequelize } from './lib/db.js';
import './models/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://maple.caadiq.co.kr'
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/menus', menuRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/boss-crystal', bossCrystalRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('DB 연결 성공');
    await sequelize.sync();
    console.log('테이블 동기화 완료');

    app.listen(PORT, () => {
      console.log(`서버 시작: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('서버 시작 실패:', err);
    process.exit(1);
  }
}

start();
