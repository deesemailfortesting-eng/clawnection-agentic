const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

/** Satisfies strict DOM typings for WebCrypto (ArrayBuffer vs SharedArrayBuffer). */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return new Uint8Array(out);
}

/** Copy into a standalone buffer for WebCrypto `BufferSource` typing. */
function copyU8(bytes: Uint8Array): Uint8Array {
  const buf = new ArrayBuffer(bytes.byteLength);
  const out = new Uint8Array(buf);
  out.set(bytes);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = copyU8(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
  const enc = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]);
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS,
  );
  const hash = new Uint8Array(hashBuffer);
  return `pbkdf2_sha256$${ITERATIONS}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 100_000) return false;
  const salt = copyU8(b64urlToBytes(parts[2]!));
  const expected = copyU8(b64urlToBytes(parts[3]!));
  const enc = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]);
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8,
  );
  return timingSafeEqual(new Uint8Array(hashBuffer), expected);
}
