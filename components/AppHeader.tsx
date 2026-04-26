"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AppHeader() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="mb-6 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
      <Link
        href="/"
        className="touch-target flex items-center gap-2 rounded-lg text-[var(--text-primary)] outline-none ring-offset-2 ring-offset-[var(--surface-base)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="text-lg font-semibold tracking-tight" aria-hidden="true">
          WTF
        </span>
        <span className="sr-only">WTF Radar home</span>
        <span className="text-lg font-semibold tracking-tight text-[var(--text-muted)]" aria-hidden="true">
          Radar
        </span>
      </Link>
      <nav aria-label="Account" className="flex items-center gap-2">
        {!loading && user ? (
          <>
            <p className="max-w-[140px] truncate text-xs text-[var(--text-muted)]" title={user.email ?? undefined}>
              {user.email ?? "Signed in"}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="touch-target rounded-full border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition active:scale-[0.98] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Sign out
            </button>
          </>
        ) : null}
      </nav>
    </header>
  );
}
