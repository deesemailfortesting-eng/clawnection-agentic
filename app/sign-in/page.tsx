import { Suspense } from "react";
import { SignInClient } from "./SignInClient";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--phone-outer-bg)] text-[var(--text-secondary)]">
          Loading sign-in…
        </div>
      }
    >
      <SignInClient />
    </Suspense>
  );
}
