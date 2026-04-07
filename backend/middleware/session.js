import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { redis } from '../lib/redis.js';

export const sessionMiddleware = session({
  store: new RedisStore({ client: redis, prefix: 'maple:sess:' }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14일
    sameSite: 'lax',
  },
});
