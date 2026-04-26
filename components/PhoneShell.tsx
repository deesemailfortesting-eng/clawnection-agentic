import { ReactNode } from "react";

type PhoneShellProps = {
  children: ReactNode;
  /** Visually hidden title for landmark when page already has visible h1 elsewhere */
  label?: string;
};

export function PhoneShell({ children, label = "Main content" }: PhoneShellProps) {
  return (
    <div className="phone-frame flex min-h-dvh justify-center bg-[var(--phone-outer-bg)]">
      <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col border-x border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <div
          className="flex min-h-dvh flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          role="main"
          aria-label={label}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
