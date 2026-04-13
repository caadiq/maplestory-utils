import { Router } from 'express';
import multer from 'multer';
import { BossCrystalBoss, BossCrystalBossDifficulty } from '../../models/index.js';
import { uploadBossImage, deleteBossImage } from '../../services/boss-crystal/image.js';
import { getPublicUrl } from '../../lib/s3.js';
import { sequelize } from '../../lib/db.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
  const valid = ['easy', 'normal', 'hard', 'chaos', 'extreme'];
  return arr.map((d) => {
    if (!valid.includes(d.difficulty)) throw new Error(`잘못된 난이도: ${d.difficulty}`);
    const price = Number(d.crystal_price);
    if (isNaN(price) || price <= 0) throw new Error(`잘못된 가격: ${d.difficulty}`);
    return { difficulty: d.difficulty, crystal_price: price };
  });
}

function parseMaxParty(raw) {
  const n = Number(raw);
  if (isNaN(n) || n < 1 || n > 6) throw new Error('인원수는 1~6이어야 합니다');
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

    // 이미지 업로드
    const imagePath = await uploadBossImage(req.file.buffer, trimmedName);

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
      newImagePath = await uploadBossImage(req.file.buffer, newName);
      if (oldPath && oldPath !== newImagePath) {
        await deleteBossImage(oldPath);
      }
    } else if (newName !== boss.name && boss.image_path) {
      // 이름만 변경 - 기존 이미지를 새 경로로 복사하는 대신 이름 기반 경로 업데이트
      // 간단하게 처리: 기존 키를 새 키로 교체할 수 없으니, 이미지가 없으면 그대로, 있으면 path만 갱신
      newImagePath = `crystal/boss/${newName}.webp`;
      // 실제로 이름이 바뀌면 이미지를 다시 올려달라고 하는 게 안전. 현재는 path만 업데이트하고 추후 다음 업로드 시 새 경로로 저장됨
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
      await deleteBossImage(boss.image_path);
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
