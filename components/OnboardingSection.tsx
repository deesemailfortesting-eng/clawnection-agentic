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
  const headingId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`;

  return (
    <section aria-labelledby={headingId} className="obsidian-card rounded-[28px] p-5">
      <h2 id={headingId} className="text-xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}
