import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { TimerSound } from '../../models/index.js';
import { uploadObject, deleteObject } from '../../lib/s3.js';
import { sequelize } from '../../lib/db.js';
import { UPLOAD_FILE_SIZE_LIMIT } from '../../constants.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT },
});

const KINDS = ['alarm', 'tts'];
const EXT_TYPES = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' };

const serialize = (s) => ({
  id: s.id,
  key: s.key,
  name: s.name,
  kind: s.kind,
  url: `/api/timer/sounds/${encodeURIComponent(s.key)}/audio`,
  size: s.size,
  sort_order: s.sort_order,
});

/** 삭제 실패로 요청 전체가 깨지지 않게 (S3에 남은 파일은 고아가 될 뿐이다) */
async function safeDelete(key) {
  try {
    await deleteObject(key);
  } catch (err) {
    console.error('알림음 S3 삭제 실패:', key, err.message);
  }
}

router.get('/sounds', async (_req, res) => {
  try {
    const rows = await TimerSound.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    res.json(rows.map(serialize));
  } catch (err) {
    console.error('알림음 목록 조회 오류:', err.message);
    res.status(500).json({ error: '알림음 목록 조회 실패' });
  }
});

router.post('/sounds', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

  const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'alarm';
  const name = (req.body.name || req.file.originalname.replace(/\.[^.]+$/, '')).trim();
  if (!name) return res.status(400).json({ error: '이름이 필요합니다' });

  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  if (!EXT_TYPES[ext]) {
    return res.status(400).json({ error: '지원하지 않는 형식입니다 (mp3 · ogg · wav · m4a)' });
  }

  // 설정에 저장되는 값이라 파일명·표시 이름과 무관하게 고정되어야 한다
  const key = `s${crypto.randomBytes(6).toString('hex')}`;
  const path = `timer-sounds/${key}.${ext}`;

  try {
    const last = await TimerSound.findOne({ order: [['sort_order', 'DESC']] });
    await uploadObject(path, req.file.buffer, EXT_TYPES[ext]);
    let row;
    try {
      row = await TimerSound.create({
        key, name, kind, path,
        size: req.file.size,
        sort_order: (last?.sort_order ?? -1) + 1,
      });
    } catch (dbErr) {
      // DB 저장이 실패하면 방금 올린 파일은 아무도 못 찾는 쓰레기가 된다
      await safeDelete(path);
      throw dbErr;
    }
    res.json(serialize(row));
  } catch (err) {
    console.error('알림음 업로드 오류:', err.message);
    res.status(500).json({ error: '알림음 업로드 실패' });
  }
});

/** 이름·종류만 수정한다 (음원 자체를 바꾸려면 새로 올리고 지우는 편이 안전하다) */
router.patch('/sounds/:id', async (req, res) => {
  try {
    const row = await TimerSound.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: '알림음을 찾을 수 없습니다' });

    if (req.body.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: '이름이 필요합니다' });
      row.name = name;
    }
    if (req.body.kind != null) {
      if (!KINDS.includes(req.body.kind)) return res.status(400).json({ error: '알 수 없는 종류입니다' });
      row.kind = req.body.kind;
    }
    await row.save();
    res.json(serialize(row));
  } catch (err) {
    console.error('알림음 수정 오류:', err.message);
    res.status(500).json({ error: '알림음 수정 실패' });
  }
});

router.delete('/sounds/:id', async (req, res) => {
  try {
    const row = await TimerSound.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: '알림음을 찾을 수 없습니다' });
    const path = row.path;
    await row.destroy();
    await safeDelete(path);
    res.json({ success: true });
  } catch (err) {
    console.error('알림음 삭제 오류:', err.message);
    res.status(500).json({ error: '알림음 삭제 실패' });
  }
});

router.post('/sounds/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '정렬할 알림음 ID 목록이 필요합니다' });
  }
  try {
    await sequelize.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await TimerSound.update({ sort_order: i }, { where: { id: ids[i] }, transaction: tx });
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('알림음 정렬 변경 오류:', err.message);
    res.status(500).json({ error: '알림음 정렬 변경 실패' });
  }
});

export default router;
