import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { TimerSound } from '../../models/index.js';
import { uploadObject, deleteObject } from '../../lib/s3.js';
import { sequelize } from '../../lib/db.js';
import { UPLOAD_FILE_SIZE_LIMIT } from '../../constants.js';

const router = Router();
/** 한 번에 올릴 수 있는 개수 — 알림음을 한 벌씩 갈아끼우는 정도면 충분하다 */
const MAX_FILES = 20;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT, files: MAX_FILES },
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

router.post('/sounds', upload.array('files', MAX_FILES), async (req, res) => {
  const files = req.files ?? [];
  if (!files.length) return res.status(400).json({ error: '파일이 없습니다' });

  /*
   * 종류는 파일마다 다를 수 있다 — 알림음과 음성을 섞어 올리는 게 자연스럽다.
   * kinds는 files와 같은 순서의 JSON 배열이다 (FormData는 넣은 순서를 지킨다).
   * 없거나 깨졌으면 예전처럼 kind 하나를 전부에 적용한다.
   */
  const fallback = KINDS.includes(req.body.kind) ? req.body.kind : 'alarm';
  let kinds = [];
  try {
    const parsed = JSON.parse(req.body.kinds ?? '[]');
    if (Array.isArray(parsed)) kinds = parsed;
  } catch {
    kinds = [];
  }
  const kindAt = (i) => (KINDS.includes(kinds[i]) ? kinds[i] : fallback);

  /*
   * 한 장씩 따로 처리한다 — 한 파일이 잘못돼도 나머지는 들어가야 한다.
   * 열 개를 골랐는데 그중 하나가 지원 안 하는 형식이라고 전부 되돌리면,
   * 뭐가 문제였는지도 모른 채 처음부터 다시 골라야 한다.
   */
  const added = [];
  const failed = [];

  // 순서는 한 번만 읽고 여기서 늘려 나간다 (파일마다 다시 읽으면 같은 번호가 겹친다)
  const last = await TimerSound.findOne({ order: [['sort_order', 'DESC']] }).catch(() => null);
  let order = (last?.sort_order ?? -1) + 1;

  for (const [index, file] of files.entries()) {
    // 이름은 따로 받지 않는다 — 화면에 보이는 건 순서대로 매기는 번호이고,
    // 여기 이름은 "어떤 파일인지" 알아보기 위한 것이라 올린 파일명이 가장 정확하다
    const name = file.originalname.trim() || '이름 없음';
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!EXT_TYPES[ext]) {
      failed.push({ name, error: '지원하지 않는 형식입니다 (mp3 · ogg · wav · m4a)' });
      continue;
    }

    // 설정에 저장되는 값이라 파일명·표시 이름과 무관하게 고정되어야 한다
    const key = `s${crypto.randomBytes(6).toString('hex')}`;
    const path = `timer-sounds/${key}.${ext}`;
    try {
      await uploadObject(path, file.buffer, EXT_TYPES[ext]);
      try {
        const row = await TimerSound.create({
          key, name, kind: kindAt(index), path, size: file.size, sort_order: order,
        });
        order += 1;
        added.push(serialize(row));
      } catch (dbErr) {
        // DB 저장이 실패하면 방금 올린 파일은 아무도 못 찾는 쓰레기가 된다
        await safeDelete(path);
        throw dbErr;
      }
    } catch (err) {
      console.error('알림음 업로드 오류:', name, err.message);
      failed.push({ name, error: '업로드 실패' });
    }
  }

  // 하나도 못 올렸으면 실패로 알린다 — 성공한 게 있으면 실패 목록만 딸려 보낸다
  if (!added.length) return res.status(400).json({ error: failed[0]?.error || '업로드 실패', failed });
  res.json({ added, failed });
});

/** 종류만 바꾼다 (이름은 파일명 그대로, 음원 교체는 새로 올리고 지우는 편이 안전하다) */
router.patch('/sounds/:id', async (req, res) => {
  try {
    const row = await TimerSound.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: '알림음을 찾을 수 없습니다' });

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
