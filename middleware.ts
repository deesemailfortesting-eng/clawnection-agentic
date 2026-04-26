import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { sessionCookieName } from "@/lib/auth/session";

function sessionSecret(): string | undefined {
  return process.env.AUTH_SESSION_SECRET?.trim();
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/sign-in") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const secret = sessionSecret();
  if (!secret) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}

export const config = {
  matcher: ["/", "/onboarding/:path*", "/voice-onboarding/:path*", "/upload-data/:path*", "/demo/:path*", "/results/:path*"],
};
