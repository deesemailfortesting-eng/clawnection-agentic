import Link from "next/link";

export function AppHeader() {
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
    </header>
  );
}
