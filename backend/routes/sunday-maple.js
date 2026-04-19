import { Router } from 'express';
import { SundayMaple } from '../models/index.js';
import {
  currentWeekFriday,
  isInSundayWindow,
  fetchAndSaveSundayMaple,
} from '../services/sundayMaple.js';

const router = Router();

// 이번 주 썬데이 메이플 조회 (금~일만 available)
router.get('/current', async (req, res) => {
  try {
    if (!isInSundayWindow()) {
      return res.json({ available: false });
    }

    const weekStart = currentWeekFriday();
    let row = await SundayMaple.findOne({ where: { week_start: weekStart } });

    // DB에 없으면 lazy fetch 시도 (cron이 놓친 경우 대비)
    if (!row) {
      try {
        row = await fetchAndSaveSundayMaple();
      } catch (err) {
        console.error('[sunday-maple] lazy fetch 실패:', err.message);
      }
    }

    if (!row) return res.json({ available: false });

    res.json({
      available: true,
      variant: row.variant,
      week_start: row.week_start,
      image_url: row.image_url,
      event_post_url: row.event_post_url,
    });
  } catch (err) {
    console.error('[sunday-maple/current] 오류:', err);
    res.status(500).json({ error: '조회 실패' });
  }
});

export default router;
