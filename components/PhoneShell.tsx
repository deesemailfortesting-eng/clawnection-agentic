import Link from "next/link";
import { ReactNode } from "react";

type PhoneShellProps = {
  children: ReactNode;
  showNav?: boolean;
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/voice-onboarding", label: "Voice" },
  { href: "/demo", label: "Match" },
];

export function PhoneShell({ children, showNav = false }: PhoneShellProps) {
  return (
    <div className="phone-shell">
      <div className="phone-frame">
        {showNav ? (
          <div className="screen-padding pb-0">
            <nav aria-label="Primary navigation" className="mb-7 flex items-center justify-between gap-3">
              <Link href="/" className="text-lg font-black tracking-tight text-white" aria-label="wtfradar home">
                wtf<span className="radar-text-gradient">radar</span>
              </Link>
              <ul className="flex items-center gap-1 text-xs font-bold text-white/58">
                {navItems.slice(1).map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="rounded-full px-2.5 py-2 transition hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
