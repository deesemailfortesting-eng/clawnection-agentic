import Link from "next/link";

const featureCards = [
  {
    title: "Personal AI Representation",
    description:
      "Users can be represented by hosted Clawnection personal agents tuned to their preferences and boundaries.",
  },
  {
    title: "Bring Your Own Agent",
    description:
      "Clawnection also supports an external agent path, demonstrated now with a mock adapter interface.",
  },
  {
    title: "Bounded Virtual Dates",
    description:
      "Agents run a structured virtual-date protocol first, then produce a recommendation before humans decide what to do.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">Clawnection · Agentic Matchmaking MVP</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Romance-first matching where agents date first and humans stay in control.
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-7 text-zinc-600">
            Clawnection is agentic matching infrastructure for modern relationships. Personal agents run structured virtual dates,
            compare intent, values, and compatibility signals, then recommend whether two people should meet in real life.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/onboarding" className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700">
              Create My Profile
            </Link>
            <Link href="/demo" className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-900">
              Try Demo Match
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{card.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-zinc-900">How the prototype works</h2>
          <ol className="mt-5 space-y-3 text-sm text-zinc-700">
            <li>1. You create a lightweight romantic profile and choose hosted or external/mock agent mode.</li>
            <li>2. Two agents run a bounded virtual-date protocol (introductions → chemistry) in six rounds.</li>
            <li>3. Clawnection generates strengths, concerns, a first-date idea, and a recommendation.</li>
            <li>4. Humans decide whether to proceed. Agents recommend; people choose.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
