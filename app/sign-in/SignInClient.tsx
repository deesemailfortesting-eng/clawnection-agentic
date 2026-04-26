"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { FormEvent, useCallback, useId, useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<{
          authorization?: { id_token?: string };
        }>;
      };
    };
  }
}

export function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const registerPasswordId = useId();
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim();

  const redirectAfterAuth = useCallback(() => {
    const next = searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      router.replace(next);
    } else {
      router.replace("/");
    }
  }, [router, searchParams]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password: registerPassword }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Registration failed.");
          return;
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Sign-in failed.");
          return;
        }
      }
      redirectAfterAuth();
    } finally {
      setPending(false);
    }
  }

  async function handleAppleSignIn() {
    setError(null);
    if (!appleClientId) {
      setError("Sign in with Apple is not configured on this deployment.");
      return;
    }
    if (!window.AppleID?.auth) {
      setError("Apple sign-in script is still loading. Wait a moment and try again.");
      return;
    }
    setPending(true);
    try {
      const response = await window.AppleID.auth.signIn();
      const idToken = response.authorization?.id_token;
      if (!idToken) {
        setError("Apple did not return an identity token. Try again or use email sign-in.");
        return;
      }
      const res = await fetch("/api/auth/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identityToken: idToken }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Apple sign-in failed.");
        return;
      }
      redirectAfterAuth();
    } catch {
      setError("Apple sign-in was cancelled or failed. You can use email and password instead.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {appleClientId ? (
        <Script
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
          strategy="afterInteractive"
          onLoad={() => {
            if (!appleClientId || typeof window === "undefined") return;
            window.AppleID?.auth.init({
              clientId: appleClientId,
              scope: "name email",
              redirectURI: `${window.location.origin}/sign-in`,
              usePopup: true,
            });
          }}
        />
      ) : null}

      <PhoneShell label="Sign in to WTF Radar">
        <div className="flex flex-1 flex-col">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
            WTF Radar
          </p>
          <h1 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {mode === "sign-in" ? "Sign in" : "Create an account"}
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            {mode === "sign-in"
              ? "Use your email and password, or Sign in with Apple if your device supports it."
              : "Choose a strong password. You can add Sign in with Apple later from any supported device."}
          </p>

          <section className="mt-8 space-y-4" aria-labelledby="email-auth-heading">
            <h2 id="email-auth-heading" className="text-sm font-semibold text-[var(--text-primary)]">
              Email and password
            </h2>
            <form className="space-y-4" onSubmit={handleEmailSubmit} noValidate>
              <div>
                <label htmlFor={emailId} className="block text-xs font-medium text-[var(--text-secondary)]">
                  Email
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-obsidian mt-1"
                />
              </div>
              {mode === "sign-in" ? (
                <div>
                  <label htmlFor={passwordId} className="block text-xs font-medium text-[var(--text-secondary)]">
                    Password
                  </label>
                  <input
                    id={passwordId}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-obsidian mt-1"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor={registerPasswordId}
                    className="block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Password (at least 10 characters)
                  </label>
                  <input
                    id={registerPasswordId}
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="input-obsidian mt-1"
                  />
                </div>
              )}

              {error ? (
                <div
                  className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">
                {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              {mode === "sign-in" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                  >
                    Create an account with email
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    onClick={() => {
                      setMode("sign-in");
                      setError(null);
                    }}
                  >
                    Sign in with email
                  </button>
                </>
              )}
            </p>
          </section>

          <section className="mt-8 space-y-3" aria-labelledby="apple-heading">
            <h2 id="apple-heading" className="text-sm font-semibold text-[var(--text-primary)]">
              Sign in with Apple
            </h2>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Apple sign-in opens a secure window from Apple. If you use a private relay email, we store it so you can
              recover your account. Configure{" "}
              <code className="rounded bg-[var(--surface-elevated)] px-1">NEXT_PUBLIC_APPLE_CLIENT_ID</code> and{" "}
              <code className="rounded bg-[var(--surface-elevated)] px-1">AUTH_SESSION_SECRET</code> on the server.
            </p>
            <button
              type="button"
              onClick={() => void handleAppleSignIn()}
              disabled={pending || !appleClientId}
              className="flex w-full touch-target items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label="Sign in with Apple"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Sign in with Apple
            </button>
          </section>

          <footer className="mt-auto pt-10 text-center text-xs text-[var(--text-muted)]">
            <p>
              By continuing you agree to our approach: agents assist with matching; you stay in control of real-world
              choices.
            </p>
            <p className="mt-2">
              Need account help or reasonable accommodations?{" "}
              <a href="mailto:support@wtfradar.com" className="text-[var(--accent)] underline-offset-2 hover:underline">
                Email WTF Radar support
              </a>
              .
            </p>
          </footer>
        </div>
      </PhoneShell>
    </>
  );
}
