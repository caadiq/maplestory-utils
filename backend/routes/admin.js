import { Router } from 'express';
import multer from 'multer';
import { Image } from '../models/index.js';
import { convertAndUpload, deleteFromS3 } from '../services/image.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// 관리자 인증 미들웨어
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.NEXON_API_KEY) {
    return res.status(403).json({ error: '접근 권한이 없습니다' });
  }
  next();
}

// 키 검증 (인증 불필요)
router.post('/verify', (req, res) => {
  const { key } = req.body;
  if (key === process.env.NEXON_API_KEY) {
    return res.json({ verified: true });
  }
  res.status(403).json({ error: '유효하지 않은 키입니다' });
});

// 이하 모든 라우트는 인증 필요
router.use(requireAdmin);

/* ── 이미지 관리 ── */

// 전체 이미지 이름 (중복 체크용)
router.get('/images/names', async (_req, res) => {
  try {
    const images = await Image.findAll({ attributes: ['name'] });
    res.json(images.map((img) => img.name));
  } catch (err) {
    console.error('이미지 이름 조회 오류:', err.message);
    res.status(500).json({ error: '조회 실패' });
  }
});

// 이미지 목록 (페이징 + 검색)
router.get('/images', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
  const search = (req.query.search || '').trim();

  const where = {};
  if (search) {
    const { Op } = await import('sequelize');
    where.name = { [Op.like]: `%${search}%` };
  }

  try {
    const { rows, count } = await Image.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      items: rows.map((img) => ({
        id: img.id,
        name: img.name,
        url: getPublicUrl(img.path),
        width: img.width,
        height: img.height,
        size: img.size,
        created_at: img.created_at,
      })),
      total: count,
      page,
      limit,
      total_pages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('이미지 목록 조회 오류:', err.message);
    res.status(500).json({ error: '이미지 목록 조회 실패' });
  }
});

// 이미지 업로드 (다중 지원)
router.post('/images', upload.array('files', 50), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: '파일이 없습니다' });

  const names = Array.isArray(req.body.names) ? req.body.names : [req.body.names];

  const results = [];
  const errors = [];

  // 입력 이름 정리 및 중복 사전 체크
  const requestedNames = req.files.map((file, i) =>
    (names[i] || file.originalname.replace(/\.[^.]+$/, '')).trim()
  );

  // 같은 요청 내 중복
  const seen = new Set();
  const dupInRequest = new Set();
  requestedNames.forEach((n) => {
    if (seen.has(n)) dupInRequest.add(n);
    seen.add(n);
  });

  // DB와 중복
  const existing = await Image.findAll({
    where: { name: requestedNames },
    attributes: ['name'],
  });
  const dupInDb = new Set(existing.map((i) => i.name));

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const name = requestedNames[i];

    if (dupInRequest.has(name)) {
      errors.push({ name, error: '같은 이름이 요청에 중복됩니다' });
      continue;
    }
    if (dupInDb.has(name)) {
      errors.push({ name, error: '이미 같은 이름의 이미지가 존재합니다' });
      continue;
    }

    try {
      const { path, width, height, size } = await convertAndUpload(file.buffer);
      const image = await Image.create({ name, path, width, height, size });
      results.push({
        id: image.id,
        name: image.name,
        url: getPublicUrl(image.path),
        width: image.width,
        height: image.height,
        size: image.size,
      });
    } catch (err) {
      console.error(`이미지 업로드 오류 (${file.originalname}):`, err.message);
      errors.push({ name, error: err.message });
    }
  }

  res.json({ uploaded: results, errors });
});

// 이미지 다중 삭제
router.post('/images/delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '삭제할 이미지를 선택해주세요' });
  }

  try {
    const images = await Image.findAll({ where: { id: ids } });

    await Promise.all(
      images.map((img) =>
        deleteFromS3(img.path).catch((err) =>
          console.warn(`S3 삭제 실패 (${img.path}):`, err.message)
        )
      )
    );
    await Image.destroy({ where: { id: ids } });

    res.json({ success: true, deleted: images.length });
  } catch (err) {
    console.error('이미지 삭제 오류:', err.message);
    res.status(500).json({ error: '이미지 삭제 실패' });
  }
});

export default router;
