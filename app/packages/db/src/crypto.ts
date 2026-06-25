import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for credential values at rest (AES-256-GCM).
 * The key is derived from APP_SECRET via scrypt, so only the env-held secret can decrypt.
 */

export interface Encrypted {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

function keyFromSecret(secret: string): Buffer {
  if (!secret) throw new Error('APP_SECRET is not set — cannot encrypt/decrypt credentials.');
  return scryptSync(secret, 'eliteflow-nebula', 32);
}

export function encrypt(plaintext: string, secret: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt(enc: Encrypted, secret: string): string {
  const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.authTag, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(enc.ciphertext, 'base64')), decipher.final()]);
  return pt.toString('utf8');
}
