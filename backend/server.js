import express from 'express';
import cors from 'cors';
import { sessionMiddleware } from './middleware/session.js';
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/characters.js';
import bossRoutes from './routes/boss/bosses.js';
import selectionRoutes from './routes/boss/selections.js';
import calculateRoutes from './routes/boss/calculate.js';
import { sequelize } from './lib/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://maple.caadiq.co.kr'
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/boss', bossRoutes);
app.use('/api/boss/selections', selectionRoutes);
app.use('/api/boss/calculate', calculateRoutes);

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
