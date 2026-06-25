import { query } from './index.js';
import { encrypt, decrypt } from './crypto.js';

export type CredentialKind = 'oauth_token' | 'api_key';

export interface ActiveCredential {
  kind: CredentialKind;
  value: string;
  expiresAt: string | null;
}

const secret = (): string => process.env.APP_SECRET ?? '';

interface CredRow {
  kind: CredentialKind;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  expires_at: string | null;
}

/** Decrypted active credential, or null if none configured. Used by the orchestrator. */
export async function getActiveCredential(): Promise<ActiveCredential | null> {
  const { rows } = await query<CredRow>(
    `SELECT kind, ciphertext, iv, auth_tag, expires_at
       FROM credentials WHERE active = true ORDER BY id DESC LIMIT 1`,
  );
  const r = rows[0];
  if (!r) return null;
  try {
    const value = decrypt({ ciphertext: r.ciphertext, iv: r.iv, authTag: r.auth_tag }, secret());
    return { kind: r.kind, value, expiresAt: r.expires_at };
  } catch {
    // GCM auth failure → the credential was encrypted under a different APP_SECRET
    // (typically because the installer was re-run and regenerated it).
    throw new Error(
      'CREDENTIAL_DECRYPT_FAILED: the stored Claude credential could not be decrypted ' +
      '(APP_SECRET changed). Open "Connect Claude" and paste your token/key again.',
    );
  }
}

/** Encrypt and store a new active credential, retiring any previous one. */
export async function saveCredential(
  kind: CredentialKind, value: string, expiresAt: string | null = null,
): Promise<void> {
  const enc = encrypt(value, secret());
  await query(`UPDATE credentials SET active = false WHERE active = true`);
  await query(
    `INSERT INTO credentials (kind, ciphertext, iv, auth_tag, expires_at, active)
     VALUES ($1, $2, $3, $4, $5, true)`,
    [kind, enc.ciphertext, enc.iv, enc.authTag, expiresAt],
  );
}

/** Non-secret status for the UI (never returns the value). */
export async function credentialStatus(): Promise<{ configured: boolean; kind?: CredentialKind; expiresAt?: string | null }> {
  const { rows } = await query<{ kind: CredentialKind; expires_at: string | null }>(
    `SELECT kind, expires_at FROM credentials WHERE active = true ORDER BY id DESC LIMIT 1`,
  );
  const r = rows[0];
  return r ? { configured: true, kind: r.kind, expiresAt: r.expires_at } : { configured: false };
}
