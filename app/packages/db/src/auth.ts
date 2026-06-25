import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { query } from './index.js';

/** Single dashboard operator login. The password is stored salted + scrypt-hashed. */

export async function isPasswordSet(): Promise<boolean> {
  const { rows } = await query(`SELECT 1 FROM app_auth WHERE id = 1 AND password_hash IS NOT NULL`);
  return rows.length > 0;
}

export async function setPassword(password: string): Promise<void> {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  await query(
    `INSERT INTO app_auth (id, password_hash, salt, updated_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
                                    salt = EXCLUDED.salt, updated_at = now()`,
    [hash, salt],
  );
}

export async function verifyPassword(password: string): Promise<boolean> {
  const { rows } = await query<{ password_hash: string | null; salt: string | null }>(
    `SELECT password_hash, salt FROM app_auth WHERE id = 1`,
  );
  const r = rows[0];
  if (!r?.password_hash || !r.salt) return false;
  const candidate = scryptSync(password, r.salt, 64);
  const stored = Buffer.from(r.password_hash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
