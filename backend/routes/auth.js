import { Router } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { User, Session } from '../models/index.js';
import { parseCookies, buildSessionCookie, sessionExpiry } from '../middleware/session.js';

const router = Router();
const NEXON_API_BASE = 'https://open.api.nexon.com';
const MAINTENANCE_CODES = ['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'];

function publicUser(user) {
  return { id: user.id, nickname: user.nickname, is_admin: user.is_admin };
}

// 넥슨 API 키로 로그인 — 계정의 대표 캐릭터(최고 레벨) ocid로 user를 식별/생성하고 세션 발급.
// 키 자체는 저장하지 않는다(검증에만 사용).
router.post('/login', async (req, res) => {
  const nexonKey = req.body?.nexonKey?.trim();
  if (!nexonKey) return res.status(400).json({ error: 'API 키가 필요합니다' });

  try {
    const { data } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/character/list`, {
      headers: { 'x-nxopen-api-key': nexonKey },
    });

    // 모든 캐릭터 중 최고 레벨을 계정 대표로
    let rep = null;
    for (const acc of data.account_list || []) {
      for (const c of acc.character_list || []) {
        if (!rep || (c.character_level || 0) > (rep.character_level || 0)) rep = c;
      }
    }
    if (!rep?.ocid) return res.status(404).json({ error: '계정에서 캐릭터를 찾을 수 없습니다' });

    const [user] = await User.findOrCreate({
      where: { ocid: rep.ocid },
      defaults: { ocid: rep.ocid, nickname: rep.character_name, is_admin: false },
    });
    if (user.nickname !== rep.character_name) {
      user.nickname = rep.character_name;
      await user.save();
    }

    const sid = crypto.randomBytes(32).toString('hex');
    await Session.create({ id: sid, user_id: user.id, expires_at: sessionExpiry() });
    res.setHeader('Set-Cookie', buildSessionCookie(sid));

    res.json({ user: publicUser(user) });
  } catch (err) {
    const code = err.response?.data?.error?.name;
    if (MAINTENANCE_CODES.includes(code)) {
      return res.status(503).json({ error: 'API 점검중입니다', maintenance: true });
    }
    if ([400, 401, 403].includes(err.response?.status)) {
      return res.status(401).json({ error: '유효하지 않은 API 키입니다' });
    }
    console.error('로그인 오류:', err.response?.data || err.message);
    res.status(500).json({ error: '로그인 실패' });
  }
});

router.post('/logout', async (req, res) => {
  const sid = parseCookies(req).sid;
  if (sid) await Session.destroy({ where: { id: sid } }).catch(() => {});
  res.setHeader('Set-Cookie', buildSessionCookie('', { clear: true }));
  res.json({ success: true });
});

// 현재 로그인 상태 복구 (새로고침 시). attachUser가 채운 req.user 사용.
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다' });
  res.json({ user: publicUser(req.user) });
});

export default router;
