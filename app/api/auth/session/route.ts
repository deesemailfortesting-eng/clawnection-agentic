import { NextRequest, NextResponse } from "next/server";
import { getSessionSecret, sessionCookieName, verifySessionToken } from "@/lib/auth/session";

export const runtime = "edge";

function readCookie(req: NextRequest, name: string): string | null {
  const raw = req.cookies.get(name)?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(req: NextRequest) {
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json({ user: null, configured: false });
  }

  const token = readCookie(req, sessionCookieName());
  if (!token) {
    return NextResponse.json({ user: null, configured: true });
  }

  const session = await verifySessionToken(token, secret);
  if (!session) {
    return NextResponse.json({ user: null, configured: true });
  }

  return NextResponse.json({
    user: { id: session.sub, email: session.email },
    configured: true,
  });
}
