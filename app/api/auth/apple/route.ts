import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyAppleIdentityToken } from "@/lib/auth/apple";
import {
  buildSessionCookie,
  getSessionSecret,
  sessionMaxAgeSeconds,
  signSessionToken,
} from "@/lib/auth/session";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Server authentication is not configured. Set AUTH_SESSION_SECRET." },
      { status: 503 },
    );
  }

  const clientId =
    process.env.APPLE_CLIENT_ID?.trim() || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "Sign in with Apple is not configured. Set NEXT_PUBLIC_APPLE_CLIENT_ID (Apple Services ID) for the button and token audience.",
      },
      { status: 503 },
    );
  }

  let body: { identityToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const identityToken = typeof body.identityToken === "string" ? body.identityToken : "";
  if (!identityToken) {
    return NextResponse.json({ error: "Missing Apple identity token." }, { status: 400 });
  }

  const claims = await verifyAppleIdentityToken(identityToken, clientId);
  if (!claims) {
    return NextResponse.json({ error: "Could not verify Apple sign-in. Try again." }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).DB;

  const email =
    typeof claims.email === "string" && claims.email.length > 0 ? claims.email.trim().toLowerCase() : null;

  const existing = await db
    .prepare("SELECT id, email FROM users WHERE apple_sub = ?")
    .bind(claims.sub)
    .first<{ id: string; email: string | null }>();

  let userId: string;
  let userEmail: string | null;

  if (existing) {
    userId = existing.id;
    userEmail = existing.email;
    if (email && !existing.email) {
      await db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, userId).run();
      userEmail = email;
    }
  } else {
    userId = crypto.randomUUID();
    try {
      await db
        .prepare("INSERT INTO users (id, email, apple_sub) VALUES (?,?,?)")
        .bind(userId, email, claims.sub)
        .run();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") && email) {
        return NextResponse.json(
          {
            error: "This email is already registered with a password. Sign in with email and password instead.",
          },
          { status: 409 },
        );
      }
      throw e;
    }
    userEmail = email;
  }

  const token = await signSessionToken({ sub: userId, email: userEmail }, secret);
  const res = NextResponse.json({ ok: true, user: { id: userId, email: userEmail } });
  res.headers.append("Set-Cookie", buildSessionCookie(token, sessionMaxAgeSeconds()));
  return res;
}
