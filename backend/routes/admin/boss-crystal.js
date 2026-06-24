import { Router } from 'express';
import multer from 'multer';
import { BossCrystalBoss, BossCrystalBossDifficulty } from '../../models/index.js';
import { convertAndUploadTo, safeDelete, safeRename } from '../../services/image.js';

const BOSS_IMAGE_PREFIX = 'crystal/boss';
const bossImagePath = (name) => `${BOSS_IMAGE_PREFIX}/${name}.webp`;
import { getPublicUrl } from '../../lib/s3.js';
import { sequelize } from '../../lib/db.js';
import { UPLOAD_FILE_SIZE_LIMIT, PARTY_SIZE, DIFFICULTIES } from '../../constants.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT },
});

function serialize(boss) {
  const json = boss.toJSON();
  return {
    id: json.id,
    name: json.name,
    image_url: json.image_path ? getPublicUrl(json.image_path) : null,
    image_path: json.image_path,
    max_party_size: json.max_party_size,
    sort_order: json.sort_order,
    difficulties: (json.difficulties || []).map((d) => ({
      id: d.id,
      difficulty: d.difficulty,
      crystal_price: Number(d.crystal_price),
    })),
  };
}

function parseDifficulties(raw) {
  if (!raw) return [];
  let arr;
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('난이도 정보 형식이 잘못되었습니다');
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('하나 이상의 난이도가 필요합니다');
  }
  return arr.map((d) => {
    if (!DIFFICULTIES.includes(d.difficulty)) throw new Error(`잘못된 난이도: ${d.difficulty}`);
    const price = Number(d.crystal_price);
    if (isNaN(price) || price <= 0) throw new Error(`잘못된 가격: ${d.difficulty}`);
    return { difficulty: d.difficulty, crystal_price: price };
  });
}

function parseMaxParty(raw) {
  const n = Number(raw);
  if (isNaN(n) || n < PARTY_SIZE.min || n > PARTY_SIZE.max) {
    throw new Error(`인원수는 ${PARTY_SIZE.min}~${PARTY_SIZE.max}이어야 합니다`);
  }
  return n;
}

// 목록
router.get('/bosses', async (_req, res) => {
  try {
    const bosses = await BossCrystalBoss.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [{ model: BossCrystalBossDifficulty, as: 'difficulties' }],
    });
    res.json(bosses.map(serialize));
  } catch (err) {
    console.error('보스 목록 조회 오류:', err.message);
    res.status(500).json({ error: '보스 목록 조회 실패' });
  }
});

// 단일 조회
router.get('/bosses/:id', async (req, res) => {
  try {
    const boss = await BossCrystalBoss.findByPk(req.params.id, {
      include: [{ model: BossCrystalBossDifficulty, as: 'difficulties' }],
    });
    if (!boss) return res.status(404).json({ error: '보스를 찾을 수 없습니다' });
    res.json(serialize(boss));
  } catch (err) {
    console.error('보스 조회 오류:', err.message);
    res.status(500).json({ error: '보스 조회 실패' });
  }
});

// 생성
router.post('/bosses', upload.single('image'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '보스 이름을 입력해주세요' });
  if (!req.file) return res.status(400).json({ error: '보스 이미지를 업로드해주세요' });

  const trimmedName = name.trim();

  try {
    const difficulties = parseDifficulties(req.body.difficulties);
    const maxPartySize = parseMaxParty(req.body.max_party_size);

    // 중복 체크
    const existing = await BossCrystalBoss.findOne({ where: { name: trimmedName } });
    if (existing) return res.status(400).json({ error: '같은 이름의 보스가 이미 존재합니다' });

    const imagePath = bossImagePath(trimmedName);

    // 마지막 정렬 순서
    const max = await BossCrystalBoss.max('sort_order') || 0;

    const boss = await sequelize.transaction(async (tx) => {
      const created = await BossCrystalBoss.create({
        name: trimmedName,
        image_path: imagePath,
        max_party_size: maxPartySize,
        sort_order: max + 1,
      }, { transaction: tx });

      await BossCrystalBossDifficulty.bulkCreate(
        difficulties.map((d) => ({ ...d, boss_id: created.id })),
        { transaction: tx }
      );

      // DB 작업 성공 후 업로드 — 실패 시 트랜잭션 롤백으로 고아 객체 방지
      await convertAndUploadTo(req.file.buffer, imagePath);

      return created;
    });

    const fresh = await BossCrystalBoss.findByPk(boss.id, {
      include: [{ model: BossCrystalBossDifficulty, as: 'difficulties' }],
    });
    res.json(serialize(fresh));
  } catch (err) {
    console.error('보스 생성 오류:', err.message);
    res.status(500).json({ error: err.message || '보스 생성 실패' });
  }
});

// 수정
router.patch('/bosses/:id', upload.single('image'), async (req, res) => {
  try {
    const boss = await BossCrystalBoss.findByPk(req.params.id);
    if (!boss) return res.status(404).json({ error: '보스를 찾을 수 없습니다' });

    const newName = req.body.name?.trim();
    if (!newName) return res.status(400).json({ error: '보스 이름을 입력해주세요' });

    // 이름 중복 체크 (자기 자신 제외)
    if (newName !== boss.name) {
      const dup = await BossCrystalBoss.findOne({ where: { name: newName } });
      if (dup) return res.status(400).json({ error: '같은 이름의 보스가 이미 존재합니다' });
    }

    const difficulties = parseDifficulties(req.body.difficulties);
    const maxPartySize = parseMaxParty(req.body.max_party_size);

    let newImagePath = boss.image_path;

    // 새 이미지 업로드 또는 이름 변경 시 이미지 재업로드
    if (req.file) {
      const oldPath = boss.image_path;
      const uploaded = await convertAndUploadTo(req.file.buffer, bossImagePath(newName));
      newImagePath = uploaded.path;
      if (oldPath && oldPath !== newImagePath) {
        await safeDelete(oldPath);
      }
    } else if (newName !== boss.name && boss.image_path) {
      // 이름 변경 시 기존 S3 객체를 새 경로로 이동. 이동 성공 시에만 path 갱신,
      // 실패하면 기존 경로를 유지해 이미지 깨짐을 방지한다.
      const targetPath = bossImagePath(newName);
      if (await safeRename(boss.image_path, targetPath)) {
        newImagePath = targetPath;
      }
    }

    await sequelize.transaction(async (tx) => {
      boss.name = newName;
      boss.image_path = newImagePath;
      boss.max_party_size = maxPartySize;
      await boss.save({ transaction: tx });

      await BossCrystalBossDifficulty.destroy({ where: { boss_id: boss.id }, transaction: tx });
      await BossCrystalBossDifficulty.bulkCreate(
        difficulties.map((d) => ({ ...d, boss_id: boss.id })),
        { transaction: tx }
      );
    });

    const fresh = await BossCrystalBoss.findByPk(boss.id, {
      include: [{ model: BossCrystalBossDifficulty, as: 'difficulties' }],
    });
    res.json(serialize(fresh));
  } catch (err) {
    console.error('보스 수정 오류:', err.message);
    res.status(500).json({ error: err.message || '보스 수정 실패' });
  }
});

// 삭제
router.delete('/bosses/:id', async (req, res) => {
  try {
    const boss = await BossCrystalBoss.findByPk(req.params.id);
    if (!boss) return res.status(404).json({ error: '보스를 찾을 수 없습니다' });

    if (boss.image_path) {
      await safeDelete(boss.image_path);
    }
    await boss.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('보스 삭제 오류:', err.message);
    res.status(500).json({ error: '보스 삭제 실패' });
  }
});

// 정렬 변경
router.post('/bosses/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '정렬할 보스 ID 목록이 필요합니다' });
  }

  try {
    await sequelize.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await BossCrystalBoss.update({ sort_order: i }, { where: { id: ids[i] }, transaction: tx });
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('보스 정렬 변경 오류:', err.message);
    res.status(500).json({ error: '보스 정렬 변경 실패' });
  }
});

export default router;
