import { User, Session } from '../models/index.js';

// 쿠키 헤더 직접 파싱 (sid 하나만 다루므로 외부 의존성 불필요)
export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const SESSION_DAYS = 30;

export function buildSessionCookie(sid, { clear = false } = {}) {
  const parts = [
    `sid=${clear ? '' : sid}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${clear ? 0 : SESSION_DAYS * 86400}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
}

// 쿠키의 sid로 세션을 조회해 req.user를 채운다 (없으면 그냥 통과 — 게스트 허용).
export async function attachUser(req, _res, next) {
  try {
    const sid = parseCookies(req).sid;
    if (sid) {
      const session = await Session.findByPk(sid, { include: [{ model: User, as: 'user' }] });
      if (session && new Date(session.expires_at) > new Date()) {
        req.user = session.user;
        req.sessionId = sid;
      }
    }
  } catch (err) {
    console.error('세션 조회 오류:', err.message);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: '접근 권한이 없습니다' });
  next();
}
