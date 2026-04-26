import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyPassword } from "@/lib/auth/password";
import {
  buildSessionCookie,
  sessionMaxAgeSeconds,
  signSessionToken,
} from "@/lib/auth/session";

export const runtime = "edge";

function getSessionSecret(): string | null {
  return process.env.AUTH_SESSION_SECRET?.trim() || null;
}

export async function POST(req: NextRequest) {
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Server authentication is not configured. Set AUTH_SESSION_SECRET." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).DB;

  const row = await db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; email: string; password_hash: string | null }>();

  if (!row?.password_hash) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const token = await signSessionToken({ sub: row.id, email: row.email }, secret);
  const res = NextResponse.json({ ok: true, user: { id: row.id, email: row.email } });
  res.headers.append("Set-Cookie", buildSessionCookie(token, sessionMaxAgeSeconds()));
  return res;
}
