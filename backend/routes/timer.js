import { Router } from 'express';
import { TimerSound } from '../models/index.js';
import { getObjectStream } from '../lib/s3.js';

const router = Router();

/**
 * 알림음 목록 (공개).
 * 사용자 화면의 드롭다운이 이걸로 채워진다 — 관리자가 추가하면 새로고침만으로 반영된다.
 */
router.get('/sounds', async (_req, res) => {
  try {
    const rows = await TimerSound.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    res.json(rows.map((s) => ({
      key: s.key,
      name: s.name,
      kind: s.kind,
      url: `/api/timer/sounds/${encodeURIComponent(s.key)}/audio`,
    })));
  } catch (err) {
    console.error('알림음 목록 조회 오류:', err.message);
    res.status(500).json({ error: '알림음 목록 조회 실패' });
  }
});

/**
 * 음원 파일 (공개).
 * S3를 직접 가리키지 않고 여기를 거친다 — 브라우저가 오디오를 디코딩하려면
 * fetch로 읽어야 하는데 S3 응답에는 CORS 헤더가 없어 다른 오리진에서 막힌다.
 * 내용은 바뀌지 않으므로(교체는 새 key로 올린다) 오래 캐시하게 둔다.
 */
router.get('/sounds/:key/audio', async (req, res) => {
  try {
    const row = await TimerSound.findOne({ where: { key: req.params.key } });
    if (!row) return res.status(404).json({ error: '알림음 없음' });

    const { body, contentType, contentLength } = await getObjectStream(row.path);
    res.setHeader('Content-Type', contentType || 'audio/mpeg');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    body.pipe(res);
  } catch (err) {
    console.error('알림음 파일 조회 오류:', err.message);
    if (!res.headersSent) res.status(500).json({ error: '알림음 파일 조회 실패' });
  }
});

export default router;
