-- Users table for per-user envelope encryption.
--
-- Every user has a unique Data Encryption Key (DEK). The DEK itself is
-- *wrapped* (encrypted) at rest by the app's Master Key Encryption Key (KEK)
-- and stored in `encrypted_dek`. The Master KEK lives only in environment
-- secrets and is never persisted in the database. To read or write any
-- user-owned encrypted blob, the app:
--   1. fetches `encrypted_dek` + `dek_iv`
--   2. unwraps the DEK in memory using the Master KEK
--   3. uses the raw DEK to encrypt/decrypt user payloads
--
-- Account deletion is therefore a "crypto-shred": removing this row deletes
-- the only copy of the wrapped DEK, leaving any external encrypted data
-- (D1 columns elsewhere, R2 objects, KV blobs) permanently undecryptable.
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,                -- opaque user id (UUID)
  email           TEXT NOT NULL UNIQUE,            -- canonical login identifier
  password_hash   TEXT NOT NULL,                   -- PBKDF2-SHA-256 hash, base64
  password_salt   TEXT NOT NULL,                   -- per-user salt, base64 (16 bytes)
  password_iter   INTEGER NOT NULL DEFAULT 210000, -- iteration count, can be raised over time
  encrypted_dek   TEXT NOT NULL,                   -- AES-GCM ciphertext (DEK), base64
  dek_iv          TEXT NOT NULL,                   -- AES-GCM IV used to wrap the DEK, base64 (12 bytes)
  kek_version     INTEGER NOT NULL DEFAULT 1,      -- which Master KEK was used to wrap; supports rotation
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
