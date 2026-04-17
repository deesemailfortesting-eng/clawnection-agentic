import { ReactNode } from "react";

export function OnboardingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}
