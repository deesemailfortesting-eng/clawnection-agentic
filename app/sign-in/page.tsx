"use client";

import { FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneShell } from "@/components/PhoneShell";

export default function SignInPage() {
  const router = useRouter();

  useEffect(() => {
    document.title = "Sign in · wtfradar";
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/onboarding");
  }

  return (
    <PhoneShell>
      <main className="screen-padding flex min-h-dvh flex-col justify-between gap-10">
        <section aria-labelledby="signin-title" className="space-y-8">
          <header className="space-y-4 pt-3">
            <Link
              href="/"
              className="pill w-fit"
              aria-label="Return to the wtfradar home screen"
            >
              wtfradar
            </Link>
            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-white/45">
                Secure sign in
              </p>
              <h1 id="signin-title" className="text-4xl font-black leading-tight tracking-[-0.04em]">
                Get back to your radar.
              </h1>
              <p className="max-w-sm text-base leading-7 text-white/68">
                Sign in to continue building your dating agent, reviewing matches,
                and deciding which introductions feel right.
              </p>
            </div>
          </header>

          <form className="obsidian-card space-y-5 rounded-[2rem] p-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-bold text-white/86">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="field"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-white/86">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="field"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="flex items-center gap-2 text-white/66">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#ff4458]"
                />
                Keep me signed in
              </label>
              <Link href="/sign-in" className="font-bold text-[#ff8a72]">
                Reset password
              </Link>
            </div>

            <button type="submit" className="primary-button w-full">
              Sign in with email
            </button>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-white/12" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/36">or</span>
              <span className="h-px flex-1 bg-white/12" />
            </div>

            <button
              type="button"
              className="secondary-button w-full gap-3"
              aria-label="Sign in with Apple"
              onClick={() => router.push("/onboarding")}
            >
              <span aria-hidden="true" className="text-xl">Apple</span>
              <span>Sign in with Apple</span>
            </button>
          </form>
        </section>

        <section aria-labelledby="signin-privacy" className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <h2 id="signin-privacy" className="text-base font-extrabold">
            Privacy by default
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Your agent can recommend introductions, but people make the final choice.
            If you need reasonable accommodations for access, contact support before a date is scheduled.
          </p>
        </section>
      </main>
    </PhoneShell>
  );
}
