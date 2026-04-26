interface CloudflareEnv {
  DB: D1Database;
  SCORING_WEIGHTS?: string;
}

/** Set in Worker / Next for session cookies and Apple token audience. */
declare namespace NodeJS {
  interface ProcessEnv {
    AUTH_SESSION_SECRET?: string;
    APPLE_CLIENT_ID?: string;
    NEXT_PUBLIC_APPLE_CLIENT_ID?: string;
  }
}
