import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PhoneShell } from "@/components/PhoneShell";

const featureCards = [
  {
    title: "Personal AI representation",
    description:
      "A hosted agent represents your preferences and boundaries during structured virtual introductions.",
  },
  {
    title: "Bring your own agent",
    description:
      "You can also use an external agent path, currently demonstrated with a mock adapter.",
  },
  {
    title: "Bounded virtual introductions",
    description:
      "Agents compare intent and compatibility signals first, then suggest whether two people should meet.",
  },
];

export default function HomePage() {
  return (
    <PhoneShell label="WTF Radar home">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-8 pb-6">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            WTF Radar · AI dating
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
            Dating where agents introduce first and you stay in control.
          </h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            WTF Radar pairs people through agent-led virtual introductions. Your agent shares only what you choose; you
            decide every in-person step.
          </p>
        </header>

        <nav aria-label="Primary actions" className="flex flex-col gap-3">
          <Link href="/review-profile" className="btn-primary touch-target w-full text-center no-underline">
            Create my profile
          </Link>
          <Link
            href="/voice-onboarding"
            className="btn-secondary touch-target w-full text-center no-underline"
          >
            Build profile with voice (uses your microphone)
          </Link>
          <Link href="/demo" className="btn-secondary touch-target w-full text-center no-underline">
            Run a sample virtual introduction
          </Link>
        </nav>

        <section aria-labelledby="features-heading" className="space-y-3">
          <h2 id="features-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            What you get
          </h2>
          <ul className="space-y-3">
            {featureCards.map((card) => (
              <li key={card.title} className="card-obsidian list-none">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{card.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-heading" className="card-obsidian space-y-3">
          <h2 id="how-heading" className="text-base font-semibold text-[var(--text-primary)]">
            How the product works
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
            <li>You create a romance profile by form or voice.</li>
            <li>Two agents run a short structured protocol (introduction through chemistry).</li>
            <li>You receive strengths, concerns, a first-date idea, and a plain-language recommendation.</li>
            <li>You and the other person choose what happens next. Agents advise; people decide.</li>
          </ol>
        </section>
      </div>
    </PhoneShell>
  );
}
