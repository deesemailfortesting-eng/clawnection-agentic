import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "wtfradar_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export type SessionPayload = {
  sub: string;
  email: string | null;
};

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export function getSessionSecret(): string | null {
  return process.env.AUTH_SESSION_SECRET?.trim() || null;
}

export async function signSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ email: payload.email ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecretKey(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const email = typeof payload.email === "string" && payload.email.length > 0 ? payload.email : null;
    return { sub, email };
  } catch {
    return null;
  }
}

export function sessionCookieName(): typeof COOKIE_NAME {
  return COOKIE_NAME;
}

export function sessionMaxAgeSeconds(): number {
  return MAX_AGE_SEC;
}

export function buildSessionCookie(token: string, maxAge: number = MAX_AGE_SEC): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}
