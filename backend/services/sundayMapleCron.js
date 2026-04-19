import cron from 'node-cron';
import { fetchAndSaveSundayMaple } from './sundayMaple.js';

const POLL_INTERVAL_MS = 10_000; // 10초 간격
const MAX_DURATION_MS = 5 * 60 * 1000; // 최대 5분

/**
 * 금요일 9시부터 10초 간격 폴링 → 찾으면 저장 후 종료, 5분 타임아웃.
 */
async function runPolling() {
  const started = Date.now();
  console.log('[sunday-maple cron] 폴링 시작');

  while (Date.now() - started < MAX_DURATION_MS) {
    try {
      const row = await fetchAndSaveSundayMaple();
      if (row) {
        console.log('[sunday-maple cron] 저장 완료 → 종료');
        return;
      }
    } catch (err) {
      console.warn('[sunday-maple cron] 폴링 중 오류:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log('[sunday-maple cron] 5분 타임아웃 → 종료 (lazy fallback이 커버)');
}

/**
 * 매주 금요일 09:00 KST 실행
 */
export function scheduleSundayMapleCron() {
  cron.schedule('0 9 * * 5', runPolling, { timezone: 'Asia/Seoul' });
  console.log('[sunday-maple cron] 매주 금요일 09:00 KST 스케줄 등록');
}
