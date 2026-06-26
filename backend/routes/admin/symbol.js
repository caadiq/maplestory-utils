import { Router } from 'express';
import multer from 'multer';
import { Symbol, SymbolLevel } from '../../models/index.js';
import { convertAndUploadTo, safeDelete } from '../../services/image.js';
import { getPublicUrl } from '../../lib/s3.js';
import { sequelize } from '../../lib/db.js';
import { UPLOAD_FILE_SIZE_LIMIT, SYMBOL_MASTER_LEVEL, SYMBOL_TYPES } from '../../constants.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT },
});

function imagePath(type, region) {
  return `symbol/${type}심볼(${region}).webp`;
}

function serialize(symbol) {
  const json = symbol.toJSON();
  return {
    id: json.id,
    type: json.type,
    region: json.region,
    image: json.image,
    image_url: json.image ? getPublicUrl(json.image) : null,
    max_level: json.max_level,
    daily_default: json.daily_default,
    weekly_default: json.weekly_default,
    sort_order: json.sort_order,
    levels: (json.levels || [])
      .sort((a, b) => a.level - b.level)
      .map((l) => ({
        level: l.level,
        required_count: l.required_count,
        meso_cost: Number(l.meso_cost),
      })),
  };
}

function parseLevels(raw, maxLevel) {
  if (!raw) return [];
  let arr;
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('레벨 정보 형식이 잘못되었습니다');
  }
  if (!Array.isArray(arr)) throw new Error('레벨 정보는 배열이어야 합니다');
  return arr.map((l) => {
    const level = Number(l.level);
    const required_count = Number(l.required_count);
    const meso_cost = Number(l.meso_cost);
    if (!level || level < 1 || level >= maxLevel) {
      throw new Error(`잘못된 레벨: ${l.level}`);
    }
    if (isNaN(required_count) || required_count < 0) {
      throw new Error(`잘못된 필요 개수: Lv.${level}`);
    }
    if (isNaN(meso_cost) || meso_cost < 0) {
      throw new Error(`잘못된 메소: Lv.${level}`);
    }
    return { level, required_count, meso_cost };
  });
}

function validateBasic({ type, region, max_level }) {
  if (!SYMBOL_TYPES.includes(type)) throw new Error('잘못된 심볼 종류입니다');
  const r = String(region || '').trim();
  if (!r) throw new Error('지역 이름을 입력해주세요');
  const ml = Number(max_level);
  if (!ml || ml < SYMBOL_MASTER_LEVEL.min || ml > SYMBOL_MASTER_LEVEL.max) {
    throw new Error(`만렙은 ${SYMBOL_MASTER_LEVEL.min}~${SYMBOL_MASTER_LEVEL.max} 사이여야 합니다`);
  }
  return { type, region: r, max_level: ml };
}

// 목록
router.get('/symbols', async (_req, res) => {
  try {
    const rows = await Symbol.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [{ model: SymbolLevel, as: 'levels' }],
    });
    res.json(rows.map(serialize));
  } catch (err) {
    console.error('심볼 목록 조회 오류:', err.message);
    res.status(500).json({ error: '심볼 목록 조회 실패' });
  }
});

// 단건
router.get('/symbols/:id', async (req, res) => {
  try {
    const row = await Symbol.findByPk(req.params.id, {
      include: [{ model: SymbolLevel, as: 'levels' }],
    });
    if (!row) return res.status(404).json({ error: '심볼을 찾을 수 없습니다' });
    res.json(serialize(row));
  } catch (err) {
    console.error('심볼 조회 오류:', err.message);
    res.status(500).json({ error: '심볼 조회 실패' });
  }
});

// 생성
router.post('/symbols', upload.single('image'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const basic = validateBasic(req.body);
    const levels = parseLevels(req.body.levels, basic.max_level);
    const daily_default = Number(req.body.daily_default) || 0;
    const weekly_default = Number(req.body.weekly_default) || 0;

    if (!req.file) throw new Error('심볼 이미지를 업로드해주세요');
    const key = imagePath(basic.type, basic.region);

    const maxOrder = (await Symbol.max('sort_order')) || 0;
    const created = await Symbol.create({
      type: basic.type,
      region: basic.region,
      image: key,
      max_level: basic.max_level,
      daily_default,
      weekly_default,
      sort_order: maxOrder + 1,
    }, { transaction: t });

    if (levels.length) {
      await SymbolLevel.bulkCreate(
        levels.map((l) => ({ symbol_id: created.id, ...l })),
        { transaction: t }
      );
    }

    // DB 작업 성공 후 업로드 — type+region 충돌 시 기존 이미지를 덮어쓰지 않고,
    // 업로드 실패 시 트랜잭션 롤백으로 고아 객체도 남기지 않음
    await convertAndUploadTo(req.file.buffer, key);

    await t.commit();
    const full = await Symbol.findByPk(created.id, { include: [{ model: SymbolLevel, as: 'levels' }] });
    res.status(201).json(serialize(full));
  } catch (err) {
    await t.rollback();
    console.error('심볼 생성 오류:', err.message);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: '이미 등록된 종류+지역 조합입니다' });
    }
    res.status(400).json({ error: err.message || '심볼 생성 실패' });
  }
});

// 수정
router.patch('/symbols/:id', upload.single('image'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const row = await Symbol.findByPk(req.params.id);
    if (!row) { await t.rollback(); return res.status(404).json({ error: '심볼을 찾을 수 없습니다' }); }

    const basic = validateBasic({
      type: req.body.type ?? row.type,
      region: req.body.region ?? row.region,
      max_level: req.body.max_level ?? row.max_level,
    });

    let imageKey = row.image;
    if (req.file) {
      imageKey = imagePath(basic.type, basic.region);
      await convertAndUploadTo(req.file.buffer, imageKey);
      if (row.image && row.image !== imageKey) {
        await safeDelete(row.image);
      }
    } else if (basic.type !== row.type || basic.region !== row.region) {
      // 이름/종류 변경 시 새 경로로 rename 대체 불가 → 기존 키 유지
      imageKey = row.image;
    }

    await row.update({
      type: basic.type,
      region: basic.region,
      max_level: basic.max_level,
      image: imageKey,
      daily_default: Number(req.body.daily_default) || 0,
      weekly_default: Number(req.body.weekly_default) || 0,
    }, { transaction: t });

    if (req.body.levels !== undefined) {
      const levels = parseLevels(req.body.levels, basic.max_level);
      await SymbolLevel.destroy({ where: { symbol_id: row.id }, transaction: t });
      if (levels.length) {
        await SymbolLevel.bulkCreate(
          levels.map((l) => ({ symbol_id: row.id, ...l })),
          { transaction: t }
        );
      }
    }

    await t.commit();
    const full = await Symbol.findByPk(row.id, { include: [{ model: SymbolLevel, as: 'levels' }] });
    res.json(serialize(full));
  } catch (err) {
    await t.rollback();
    console.error('심볼 수정 오류:', err.message);
    res.status(400).json({ error: err.message || '심볼 수정 실패' });
  }
});

// 삭제
router.delete('/symbols/:id', async (req, res) => {
  try {
    const row = await Symbol.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: '심볼을 찾을 수 없습니다' });
    const key = row.image;
    await row.destroy();
    if (key) await safeDelete(key);
    res.json({ success: true });
  } catch (err) {
    console.error('심볼 삭제 오류:', err.message);
    res.status(500).json({ error: '심볼 삭제 실패' });
  }
});

// 순서 변경
router.post('/symbols/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids 배열이 필요합니다' });
  const t = await sequelize.transaction();
  try {
    for (let i = 0; i < ids.length; i++) {
      await Symbol.update({ sort_order: i + 1 }, { where: { id: ids[i] }, transaction: t });
    }
    await t.commit();
    res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error('심볼 순서 변경 오류:', err.message);
    res.status(500).json({ error: '순서 변경 실패' });
  }
});

export default router;
