import Link from "next/link";
import { PhoneShell } from "@/components/PhoneShell";

const featureCards = [
  {
    title: "Your agent listens first",
    description:
      "Build a dating profile by voice or text, then let your private agent represent your intent and boundaries.",
  },
  {
    title: "Dates happen in simulation",
    description:
      "Agents run a bounded virtual date and explain their recommendation before people decide whether to meet.",
  },
  {
    title: "People stay in control",
    description:
      "wtfradar shows strengths, concerns, and a plain-language summary. You make the final choice.",
  },
];

export default function HomePage() {
  return (
    <PhoneShell>
      <main className="screen-padding space-y-8">
        <header className="space-y-6">
          <nav aria-label="Primary" className="flex items-center justify-between">
            <Link href="/" className="text-lg font-black tracking-tight text-white" aria-label="wtfradar home">
              wtf<span className="radar-text-gradient">radar</span>
            </Link>
            <Link href="/sign-in" className="secondary-button min-h-10 px-4 py-2 text-sm">
              Sign in
            </Link>
          </nav>

          <section aria-labelledby="home-title" className="space-y-5">
            <p className="pill w-fit">AI dating for the group chat era</p>
            <h1 id="home-title" className="text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white">
              Let your AI check the vibe first.
            </h1>
            <p className="text-base leading-7 text-white/70">
              wtfradar is a phone-first dating platform where personal agents run a private, structured virtual date before you spend energy on a real one.
            </p>
            <div className="grid gap-3" aria-label="Start wtfradar">
              <Link href="/sign-in" className="primary-button">
                Create a secure account
              </Link>
              <Link href="/voice-onboarding" className="secondary-button">
                Build my profile by voice
              </Link>
            </div>
          </section>
        </header>

        <section aria-labelledby="why-title" className="space-y-4">
          <h2 id="why-title" className="text-2xl font-black tracking-tight text-white">
            Dating signals, explained plainly.
          </h2>
          {featureCards.map((card) => (
            <article key={card.title} className="obsidian-card rounded-[28px] p-5">
              <h3 className="text-lg font-black text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/68">{card.description}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="flow-title" className="obsidian-panel rounded-[32px] p-5">
          <h2 id="flow-title" className="text-xl font-black text-white">How wtfradar works</h2>
          <ol className="mt-5 space-y-4 text-sm leading-6 text-white/72">
            <li><strong className="text-white">1. Sign in securely.</strong> Use email and password or Apple sign-in.</li>
            <li><strong className="text-white">2. Build your profile.</strong> Choose text onboarding or a guided voice conversation with visible instructions.</li>
            <li><strong className="text-white">3. Run a virtual date.</strong> Your agent compares values, intent, communication, and boundaries.</li>
            <li><strong className="text-white">4. Review the result.</strong> Read a clear recommendation and decide what feels right.</li>
          </ol>
        </section>

        <footer className="border-t border-white/10 pt-5 text-xs leading-5 text-white/48">
          <p>Agents recommend; people choose. If you need reasonable accommodations while using wtfradar, contact support through your account settings.</p>
        </footer>
      </main>
    </PhoneShell>
  );
}
