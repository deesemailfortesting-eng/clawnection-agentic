import { ReactNode } from "react";

type PhoneShellProps = {
  children: ReactNode;
};

export function PhoneShell({ children }: PhoneShellProps) {
  return (
    <div className="phone-shell">
      <div className="phone-frame">
        {children}
      </div>
    </div>
  );
}
