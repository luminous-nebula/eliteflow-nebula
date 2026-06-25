-- ─────────────────────────────────────────────────────────────────────────────
-- 003_app.sql — application auth & stored Claude credential (in-app onboarding)
-- ─────────────────────────────────────────────────────────────────────────────

-- Single operator login for the dashboard. Singleton row (id = 1).
CREATE TABLE IF NOT EXISTS app_auth (
  id             integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash  text,
  salt           text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- The Claude credential captured via the web "Connect Claude" page.
-- The secret value is stored ENCRYPTED (AES-256-GCM); never in plaintext.
CREATE TABLE IF NOT EXISTS credentials (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('oauth_token', 'api_key')),
  ciphertext  text NOT NULL,
  iv          text NOT NULL,
  auth_tag    text NOT NULL,
  expires_at  timestamptz,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one active credential at a time.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_credential ON credentials (active) WHERE active;
