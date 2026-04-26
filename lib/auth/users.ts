/*
 * User account management with per-user envelope encryption.
 *
 * Public API:
 *   createUser({ db, kek, email, password })
 *   authenticateUser({ db, email, password })
 *   encryptUserData({ db, kek, userId, plaintext })
 *   decryptUserData({ db, kek, userId, ciphertextB64 })
 *   deleteUser({ db, userId })   // crypto-shred
 *
 * The Master KEK is loaded once per request via {@link getMasterKekFromEnv}
 * and passed in to each call — no globals — so request handlers can do the
 * load/teardown explicitly and unit tests can swap in a synthetic KEK.
 */

import {
  base64ToBytes,
  bytesToBase64,
  decryptWithDek,
  encryptWithDek,
  generateUserDek,
  hashPassword,
  importMasterKek,
  PasswordHash,
  unwrapUserDek,
  verifyPassword,
  wrapUserDek,
} from "./crypto";

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iter: number;
  encrypted_dek: string;
  dek_iv: string;
  kek_version: number;
};

const KEK_VERSION = 1;

// -----------------------------------------------------------------------------
// Master KEK loading
// -----------------------------------------------------------------------------

/*
 * Load the Master KEK from env. The KEK is stored as a base64-encoded 32-byte
 * key (AES-256). On Workers / Pages set it as a secret named MASTER_KEK_B64.
 *
 *   wrangler secret put MASTER_KEK_B64
 *
 * Generate locally with: `openssl rand -base64 32`.
 */
export async function getMasterKekFromEnv(env: { MASTER_KEK_B64?: string }): Promise<CryptoKey> {
  const b64 = env.MASTER_KEK_B64;
  if (!b64) {
    throw new Error(
      "MASTER_KEK_B64 is not configured. Set it as an environment secret.",
    );
  }
  return importMasterKek(b64);
}

// -----------------------------------------------------------------------------
// Email + ID helpers
// -----------------------------------------------------------------------------

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateUserId(): string {
  // crypto.randomUUID is available on Workers, browsers, Node 19+.
  return crypto.randomUUID();
}

// -----------------------------------------------------------------------------
// Minimal D1-shaped DB interface so tests / non-D1 callers can stub it.
// -----------------------------------------------------------------------------

export type EnvelopeDB = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
};

// -----------------------------------------------------------------------------
// User creation — generates a fresh DEK, wraps it with the KEK, persists row.
// -----------------------------------------------------------------------------

export type CreateUserArgs = {
  db: EnvelopeDB;
  kek: CryptoKey;
  email: string;
  password: string;
};

export type CreatedUser = {
  id: string;
  email: string;
};

export async function createUser({
  db,
  kek,
  email,
  password,
}: CreateUserArgs): Promise<CreatedUser> {
  const id = generateUserId();
  const normalizedEmail = normalizeEmail(email);

  // 1. Generate a fresh per-user DEK (256-bit AES-GCM).
  const dek = await generateUserDek();

  // 2. Wrap the DEK with the Master KEK. We do this before touching the DB
  //    so a failure here (e.g. KEK is misconfigured) never leaves a half-row
  //    behind.
  const { wrappedB64: encryptedDek, ivB64: dekIv } = await wrapUserDek(dek, kek);

  // 3. Hash the password with PBKDF2-SHA-256.
  const pw = await hashPassword(password);

  // 4. Insert the user row with the wrapped DEK alongside auth fields.
  await db
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, password_salt, password_iter,
        encrypted_dek, dek_iv, kek_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(
      id,
      normalizedEmail,
      pw.hashB64,
      pw.saltB64,
      pw.iterations,
      encryptedDek,
      dekIv,
      KEK_VERSION,
    )
    .run();

  return { id, email: normalizedEmail };
}

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

export type AuthenticateUserArgs = {
  db: EnvelopeDB;
  email: string;
  password: string;
};

export async function authenticateUser({
  db,
  email,
  password,
}: AuthenticateUserArgs): Promise<{ id: string; email: string } | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(normalizeEmail(email))
    .first<UserRecord>();
  if (!row) return null;

  const pw: PasswordHash = {
    hashB64: row.password_hash,
    saltB64: row.password_salt,
    iterations: row.password_iter,
  };
  const ok = await verifyPassword(password, pw);
  if (!ok) return null;

  return { id: row.id, email: row.email };
}

// -----------------------------------------------------------------------------
// Encrypt / decrypt user data with the wrapped DEK
// -----------------------------------------------------------------------------

async function loadUserDek(
  db: EnvelopeDB,
  kek: CryptoKey,
  userId: string,
): Promise<CryptoKey> {
  const row = await db
    .prepare("SELECT encrypted_dek, dek_iv FROM users WHERE id = ?")
    .bind(userId)
    .first<Pick<UserRecord, "encrypted_dek" | "dek_iv">>();
  if (!row) throw new Error(`User ${userId} not found`);
  return unwrapUserDek(row.encrypted_dek, row.dek_iv, kek);
}

/*
 * Encrypts `plaintext` for the given user and returns a base64 blob suitable
 * for storing in any single column. The returned string contains the random
 * AES-GCM IV prefixed to the ciphertext, so the caller never has to track an
 * IV separately.
 */
export async function encryptUserData({
  db,
  kek,
  userId,
  plaintext,
}: {
  db: EnvelopeDB;
  kek: CryptoKey;
  userId: string;
  plaintext: string;
}): Promise<string> {
  const dek = await loadUserDek(db, kek, userId);
  return encryptWithDek(dek, plaintext);
}

export async function decryptUserData({
  db,
  kek,
  userId,
  ciphertextB64,
}: {
  db: EnvelopeDB;
  kek: CryptoKey;
  userId: string;
  ciphertextB64: string;
}): Promise<string> {
  const dek = await loadUserDek(db, kek, userId);
  return decryptWithDek(dek, ciphertextB64);
}

// -----------------------------------------------------------------------------
// Crypto-shredding deletion
// -----------------------------------------------------------------------------

/*
 * Account deletion. Removing the user row removes the only copy of the
 * wrapped DEK; without it, no one (not even the app) can ever decrypt that
 * user's data again. Any external blobs the app has shipped to backups, R2,
 * KV, downstream warehouses, etc. become permanently unreadable — this is
 * the entire point of the envelope model.
 *
 * Important: the caller is also responsible for deleting any rows that
 * reference this user via foreign keys. Crypto-shredding renders the
 * ciphertext useless, but well-behaved systems still purge the now-garbage
 * rows for storage hygiene and to honor right-to-erasure requests.
 */
export async function deleteUser({
  db,
  userId,
}: {
  db: EnvelopeDB;
  userId: string;
}): Promise<void> {
  await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
}

// -----------------------------------------------------------------------------
// Re-exports so callers only need to import from one module.
// -----------------------------------------------------------------------------

export { base64ToBytes, bytesToBase64 };
