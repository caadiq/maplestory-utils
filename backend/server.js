import express from 'express';
import cors from 'cors';
import adminRoutes from './routes/admin.js';
import menuRoutes from './routes/menus.js';
import noticeRoutes from './routes/notices.js';
import bossCrystalRoutes from './routes/boss-crystal.js';
import characterRoutes from './routes/character.js';
import imageRoutes from './routes/images.js';
import symbolRoutes from './routes/symbol.js';
import sundayMapleRoutes from './routes/sunday-maple.js';
import genesisPassRoutes from './routes/genesis-pass.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import { sequelize } from './lib/db.js';
import './models/index.js';
import { attachUser } from './middleware/session.js';
import { scheduleSundayMapleCron } from './services/sundayMapleCron.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://maple.caadiq.co.kr'
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(attachUser); // 쿠키 sid → req.user (게스트는 그냥 통과)

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/boss-crystal', bossCrystalRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/symbols', symbolRoutes);
app.use('/api/sunday-maple', sundayMapleRoutes);
app.use('/api/genesis-pass', genesisPassRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 전역 에러 핸들러 (multer 파일 크기 초과 등 미처리 예외가 스택 트레이스로 노출되는 것 방지)
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '파일 크기가 너무 큽니다' });
  }
  console.error('처리되지 않은 오류:', err?.message || err);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('DB 연결 성공');
    await sequelize.sync();
    console.log('테이블 동기화 완료');

    scheduleSundayMapleCron();

    app.listen(PORT, () => {
      console.log(`서버 시작: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('서버 시작 실패:', err);
    process.exit(1);
  }
}

start();
