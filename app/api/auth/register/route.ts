import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hashPassword } from "@/lib/auth/password";
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

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters for your security." },
      { status: 400 },
    );
  }

  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).DB;
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?,?,?)").bind(id, email, passwordHash).run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    throw e;
  }

  const token = await signSessionToken({ sub: id, email }, secret);
  const res = NextResponse.json({ ok: true, user: { id, email } });
  res.headers.append("Set-Cookie", buildSessionCookie(token, sessionMaxAgeSeconds()));
  return res;
}
