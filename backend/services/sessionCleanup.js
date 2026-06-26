import cron from 'node-cron';
import { Op } from 'sequelize';
import { Session } from '../models/index.js';

// 만료된 세션 행 정리
export async function cleanupExpiredSessions() {
  const n = await Session.destroy({ where: { expires_at: { [Op.lt]: new Date() } } });
  if (n > 0) console.log(`[session] 만료 세션 ${n}개 정리`);
  return n;
}

// 매일 04:00 KST 정리 + 서버 시작 시 1회
export function scheduleSessionCleanup() {
  cleanupExpiredSessions().catch((e) => console.error('세션 정리 오류:', e.message));
  cron.schedule('0 4 * * *', () => {
    cleanupExpiredSessions().catch((e) => console.error('세션 정리 오류:', e.message));
  }, { timezone: 'Asia/Seoul' });
  console.log('[session] 만료 세션 정리 cron 등록 (매일 04:00 KST)');
}
