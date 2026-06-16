import { Router } from 'express';
import { GenesisPass, Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

// 오늘(KST, YYYY-MM-DD)이 시작일~종료일 범위 안이면 활성. DATEONLY 문자열은 사전순=날짜순이라 문자열 비교로 충분.
function isActive(start, end) {
  if (!start || !end) return false;
  const todayKST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return start <= todayKST && todayKST <= end;
}

export function serializeGenesisPass(row) {
  if (!row) {
    return { active: false, start_date: null, end_date: null, multiplier: 3, image_id: null, image: null };
  }
  const json = row.toJSON();
  return {
    active: isActive(json.start_date, json.end_date),
    start_date: json.start_date,
    end_date: json.end_date,
    multiplier: json.multiplier,
    image_id: json.image_id,
    image: json.image ? { id: json.image.id, name: json.image.name, url: getPublicUrl(json.image.path) } : null,
  };
}

// 공개: 제네시스 패스 시즌 설정 조회 (해방 계산기용)
router.get('/', async (_req, res) => {
  try {
    const row = await GenesisPass.findOne({ include: [{ model: Image, as: 'image' }] });
    res.json(serializeGenesisPass(row));
  } catch (err) {
    console.error('제네시스 패스 조회 오류:', err.message);
    res.status(500).json({ error: '제네시스 패스 조회 실패' });
  }
});

export default router;
