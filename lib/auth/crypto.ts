/*
 * Web Crypto helpers used by the envelope-encryption account system.
 *
 * Only `crypto.subtle` is used — no Node `crypto` import — so this module is
 * safe to run on Cloudflare Workers / Pages / Vercel Edge Runtime.
 *
 *   Master KEK  (env secret, never in DB)
 *      │  wraps
 *      ▼
 *   User DEK   (per-user, generated at signup)
 *      │  encrypts
 *      ▼
 *   User data  (profile blobs, etc.)
 *
 * Every AES-GCM operation uses a fresh random 96-bit IV; IVs are never reused
 * for the same key. IVs are returned/stored separately from ciphertext (or
 * prepended via {@link packIvAndCipher} when persisting as a single blob).
 */

const AES_GCM_IV_BYTES = 12;
const AES_KEY_BITS = 256;

// -----------------------------------------------------------------------------
// Base64 helpers (URL-safe-tolerant). Avoids `Buffer` so the same code runs in
// the browser, Node, and the Workers runtime.
// -----------------------------------------------------------------------------

/*
 * Web Crypto's TypeScript signatures require an ArrayBuffer-backed view, but
 * TS 5.7+ types `Uint8Array.prototype.subarray` and similar as
 * `Uint8Array<ArrayBufferLike>`. We use this alias everywhere we hand bytes
 * to `subtle.*` so the compiler keeps the `ArrayBuffer` constraint.
 */
type Bytes = Uint8Array<ArrayBuffer>;

function makeBytes(length: number): Bytes {
  return new Uint8Array(new ArrayBuffer(length)) as Bytes;
}

function copyBytes(view: ArrayBufferView | ArrayBuffer): Bytes {
  const src = view instanceof ArrayBuffer ? new Uint8Array(view) : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const out = makeBytes(src.byteLength);
  out.set(src);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in Workers, browsers, and modern Node.
  return btoa(binary);
}

export function base64ToBytes(b64: string): Bytes {
  const binary = atob(b64);
  const out = makeBytes(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Random helpers
// -----------------------------------------------------------------------------

export function randomBytes(length: number): Bytes {
  const out = makeBytes(length);
  crypto.getRandomValues(out);
  return out;
}

export function randomIv(): Bytes {
  return randomBytes(AES_GCM_IV_BYTES);
}

// -----------------------------------------------------------------------------
// Master KEK loading
// -----------------------------------------------------------------------------

/*
 * Imports the application-wide Master KEK from a base64-encoded 32-byte key
 * (i.e. an AES-256 key). The KEK is loaded once per request and only ever
 * lives in memory. It is given the minimum extractability needed: it can wrap
 * and unwrap other keys and run AES-GCM, but the raw bytes cannot be exported
 * back out via `subtle.exportKey`.
 *
 * Generate one with:
 *   openssl rand -base64 32
 * and store as the MASTER_KEK_B64 environment variable / Cloudflare secret.
 */
export async function importMasterKek(masterKekB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(masterKekB64);
  if (raw.byteLength !== AES_KEY_BITS / 8) {
    throw new Error(
      `MASTER_KEK_B64 must decode to ${AES_KEY_BITS / 8} bytes (got ${raw.byteLength}).`,
    );
  }
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: AES_KEY_BITS },
    /* extractable */ false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

// -----------------------------------------------------------------------------
// AES-GCM wrap / unwrap of a user DEK by the Master KEK
// -----------------------------------------------------------------------------

/*
 * Generates a fresh per-user DEK. It is produced as `extractable: true` so we
 * can wrap it with the KEK at signup, but production reads should treat it as
 * a transient in-memory value that is never logged or persisted unwrapped.
 */
export async function generateUserDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_BITS },
    /* extractable */ true,
    ["encrypt", "decrypt"],
  );
}

/*
 * Wraps a user DEK with the Master KEK using AES-GCM. Returns the ciphertext
 * and the IV separately so callers can store them in dedicated columns.
 *
 * We use the lower-level encrypt/exportKey path rather than `subtle.wrapKey`
 * with `format: "raw"` because some runtimes' `wrapKey("raw")` paths have
 * historically been less consistent than the explicit two-step version, and
 * this is easier to reason about for an audit reviewer.
 */
export async function wrapUserDek(
  dek: CryptoKey,
  kek: CryptoKey,
): Promise<{ wrappedB64: string; ivB64: string }> {
  const rawDek = copyBytes(await crypto.subtle.exportKey("raw", dek));
  const iv = randomIv();
  const wrapped = copyBytes(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, rawDek),
  );
  return { wrappedB64: bytesToBase64(wrapped), ivB64: bytesToBase64(iv) };
}

/*
 * Reverses {@link wrapUserDek}. Returns a non-extractable AES-GCM CryptoKey
 * scoped to encrypt/decrypt only — once unwrapped the raw bytes can no longer
 * leave the runtime via exportKey.
 */
export async function unwrapUserDek(
  wrappedB64: string,
  ivB64: string,
  kek: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = base64ToBytes(wrappedB64);
  const iv = base64ToBytes(ivB64);
  const rawDek = copyBytes(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, kek, wrapped),
  );
  return crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM", length: AES_KEY_BITS },
    /* extractable */ false,
    ["encrypt", "decrypt"],
  );
}

// -----------------------------------------------------------------------------
// AES-GCM encrypt / decrypt of arbitrary user data with the unwrapped DEK
// -----------------------------------------------------------------------------

/*
 * Encrypts `plaintext` (UTF-8 string) under the user's DEK with a fresh IV.
 * Stored format is the IV (12 bytes) prepended to the ciphertext, then base64
 * encoded — so callers only ever persist a single column per encrypted field
 * and the IV is impossible to lose track of.
 */
export async function encryptWithDek(
  dek: CryptoKey,
  plaintext: string,
): Promise<string> {
  const iv = randomIv();
  const cipher = copyBytes(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      dek,
      copyBytes(new TextEncoder().encode(plaintext)),
    ),
  );
  return bytesToBase64(packIvAndCipher(iv, cipher));
}

export async function decryptWithDek(
  dek: CryptoKey,
  ciphertextB64: string,
): Promise<string> {
  const blob = base64ToBytes(ciphertextB64);
  const { iv, cipher } = unpackIvAndCipher(blob);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dek, cipher);
  return new TextDecoder().decode(plain);
}

function packIvAndCipher(iv: Bytes, cipher: Bytes): Bytes {
  const out = makeBytes(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(cipher, iv.byteLength);
  return out;
}

function unpackIvAndCipher(blob: Bytes): { iv: Bytes; cipher: Bytes } {
  if (blob.byteLength < AES_GCM_IV_BYTES + 16) {
    // 16 bytes is the smallest AES-GCM tag size — anything shorter is invalid.
    throw new Error("Encrypted blob is too short to contain an IV + ciphertext.");
  }
  const iv = makeBytes(AES_GCM_IV_BYTES);
  iv.set(blob.subarray(0, AES_GCM_IV_BYTES));
  const cipher = makeBytes(blob.byteLength - AES_GCM_IV_BYTES);
  cipher.set(blob.subarray(AES_GCM_IV_BYTES));
  return { iv, cipher };
}

// -----------------------------------------------------------------------------
// PBKDF2 password hashing — Web Crypto only
// -----------------------------------------------------------------------------

const PBKDF2_DEFAULT_ITERATIONS = 210_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_DERIVED_BITS = 256;

export type PasswordHash = {
  hashB64: string;
  saltB64: string;
  iterations: number;
};

export async function hashPassword(
  password: string,
  iterations = PBKDF2_DEFAULT_ITERATIONS,
): Promise<PasswordHash> {
  const salt = randomBytes(PBKDF2_SALT_BYTES);
  const hash = await pbkdf2(password, salt, iterations);
  return {
    hashB64: bytesToBase64(hash),
    saltB64: bytesToBase64(salt),
    iterations,
  };
}

export async function verifyPassword(
  password: string,
  expected: PasswordHash,
): Promise<boolean> {
  const salt = base64ToBytes(expected.saltB64);
  const candidate = await pbkdf2(password, salt, expected.iterations);
  const expectedBytes = base64ToBytes(expected.hashB64);
  return constantTimeEqual(candidate, expectedBytes);
}

async function pbkdf2(
  password: string,
  salt: Bytes,
  iterations: number,
): Promise<Bytes> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    copyBytes(new TextEncoder().encode(password)),
    { name: "PBKDF2" },
    /* extractable */ false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: PBKDF2_HASH, salt, iterations },
    baseKey,
    PBKDF2_DERIVED_BITS,
  );
  return copyBytes(bits);
}

/*
 * Constant-time comparison of two byte arrays. Returns false on length
 * mismatch but does *not* short-circuit on per-byte differences once the
 * lengths match, so an attacker can't time-distinguish where in the array
 * the divergence happened.
 */
function constantTimeEqual(a: Bytes, b: Bytes): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
