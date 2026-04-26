import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type AppleIdTokenClaims = {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
};

export async function verifyAppleIdentityToken(
  identityToken: string,
  clientId: string,
): Promise<AppleIdTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: clientId,
    });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    return { sub, email, email_verified: payload.email_verified as string | boolean | undefined };
  } catch {
    return null;
  }
}
