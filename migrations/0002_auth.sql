-- Authentication: email/password and Sign in with Apple
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  apple_sub     TEXT UNIQUE,
  password_hash TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub);
