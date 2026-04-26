"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = { id: string; email: string | null };

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<AuthState> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    const data = (await res.json()) as { user: AuthUser | null; configured?: boolean };
    return {
      user: data.user,
      loading: false,
      configured: data.configured !== false,
    };
  } catch {
    return { user: null, loading: false, configured: true };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, configured: true });

  const refresh = useCallback(async () => {
    const next = await fetchSession();
    setState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchSession();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState((prev) => ({ ...prev, user: null, loading: false }));
    window.location.href = "/sign-in";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, refresh, logout }),
    [state, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
