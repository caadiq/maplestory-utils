import { Router } from 'express';
import { ChallengerSeason, BossCrystalBoss } from '../../models/index.js';

const router = Router();

function parseSeason(body) {
  const seasonNumber = Number(body.season_number);
  if (!Number.isInteger(seasonNumber) || seasonNumber <= 0) {
    throw new Error('시즌 번호는 1 이상의 정수여야 합니다');
  }
  const { start_date: startDate, end_date: endDate } = body;
  if (!startDate || !endDate) throw new Error('시작일과 종료일을 입력해주세요');
  if (startDate > endDate) throw new Error('종료일이 시작일보다 빠를 수 없습니다');
  return { season_number: seasonNumber, start_date: startDate, end_date: endDate };
}

// 목록
router.get('/', async (_req, res) => {
  try {
    const seasons = await ChallengerSeason.findAll({ order: [['season_number', 'DESC']] });
    res.json(seasons);
  } catch (err) {
    console.error('챌린저스 시즌 목록 조회 오류:', err.message);
    res.status(500).json({ error: '시즌 목록 조회 실패' });
  }
});

// 생성
router.post('/', async (req, res) => {
  try {
    const data = parseSeason(req.body);
    const dup = await ChallengerSeason.findOne({ where: { season_number: data.season_number } });
    if (dup) return res.status(400).json({ error: '이미 등록된 시즌 번호입니다' });
    const season = await ChallengerSeason.create(data);
    res.json(season);
  } catch (err) {
    console.error('챌린저스 시즌 생성 오류:', err.message);
    res.status(500).json({ error: err.message || '시즌 생성 실패' });
  }
});

// 수정
router.patch('/:id', async (req, res) => {
  try {
    const season = await ChallengerSeason.findByPk(req.params.id);
    if (!season) return res.status(404).json({ error: '시즌을 찾을 수 없습니다' });
    const data = parseSeason(req.body);
    const dup = await ChallengerSeason.findOne({ where: { season_number: data.season_number } });
    if (dup && dup.id !== season.id) return res.status(400).json({ error: '이미 등록된 시즌 번호입니다' });
    Object.assign(season, data);
    await season.save();
    res.json(season);
  } catch (err) {
    console.error('챌린저스 시즌 수정 오류:', err.message);
    res.status(500).json({ error: err.message || '시즌 수정 실패' });
  }
});

// 삭제 (시즌보스로 지정된 보스가 있으면 거부)
router.delete('/:id', async (req, res) => {
  try {
    const season = await ChallengerSeason.findByPk(req.params.id);
    if (!season) return res.status(404).json({ error: '시즌을 찾을 수 없습니다' });
    const used = await BossCrystalBoss.count({ where: { season_id: season.id } });
    if (used > 0) return res.status(400).json({ error: `이 시즌의 시즌보스가 ${used}개 있습니다. 보스에서 시즌 지정을 먼저 해제해주세요` });
    await season.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('챌린저스 시즌 삭제 오류:', err.message);
    res.status(500).json({ error: '시즌 삭제 실패' });
  }
});

export default router;
