import { Router } from 'express';
import crypto from 'crypto';
import { exchangeToken, getUserInfo, refreshToken } from '../services/nexon.js';
import { User } from '../models/index.js';

const router = Router();

router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.NEXON_CLIENT_ID,
    redirect_uri: process.env.NEXON_REDIRECT_URI,
    scope: 'maplestory.characterlist',
    state,
  });

  res.redirect(`https://openid.nexon.com/oauth2/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || state !== req.session.oauthState) {
    return res.status(400).json({ error: '잘못된 요청입니다' });
  }
  delete req.session.oauthState;

  try {
    const tokens = await exchangeToken(code);
    const userInfo = await getUserInfo(tokens.access_token);

    const [user] = await User.findOrCreate({
      where: { nexon_uid: userInfo.uid },
    });

    req.session.userId = user.id;
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

    res.redirect('/');
  } catch (err) {
    console.error('OAuth 콜백 오류:', err.message);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: '로그아웃 실패' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, userId: req.session.userId });
});

export default router;
