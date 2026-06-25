import { createHmac, timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE } from './constants';

/** Signed, expiring session token (HMAC-SHA256). Verified server-side in Node. */

export { SESSION_COOKIE };

interface SessionPayload { sub: string; exp: number }

export function createSessionToken(secret: string, ttlSeconds = 86400): string {
  const payload: SessionPayload = { sub: 'operator', exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(secret: string, token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = createHmac('sha256', secret).update(data).digest();
  const got = Buffer.from(sig, 'base64url');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
