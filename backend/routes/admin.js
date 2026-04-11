import { Router } from 'express';

const router = Router();

// 관리자 인증 미들웨어
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.NEXON_API_KEY) {
    return res.status(403).json({ error: '접근 권한이 없습니다' });
  }
  next();
}

// 관리자 키 검증
router.post('/verify', (req, res) => {
  const { key } = req.body;
  if (key === process.env.NEXON_API_KEY) {
    return res.json({ verified: true });
  }
  res.status(403).json({ error: '유효하지 않은 키입니다' });
});

// 관리자 API에 미들웨어 적용
router.use(requireAdmin);

// TODO: 보스 관리 API 추가 예정

export default router;
