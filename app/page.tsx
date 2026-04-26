import Link from "next/link";
import { PhoneShell } from "@/components/PhoneShell";

export default function HomePage() {
  return (
    <PhoneShell>
      <main className="screen-padding flex min-h-dvh flex-col justify-between gap-10">
        <header className="flex items-center justify-between pt-1">
          <span className="px-1 text-lg font-black tracking-tight text-white" aria-label="wtfradar">
            wtf<span className="radar-text-gradient">radar</span>
          </span>
          <Link href="/sign-in" className="text-sm font-bold text-white/68 hover:text-white">
            Sign in
          </Link>
        </header>

        <section aria-labelledby="home-title" className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div className="voice-orb" aria-hidden="true">
            <span className="voice-orb-ring" />
            <span className="voice-orb-ring" />
            <span className="voice-orb-ring" />
            <span className="voice-orb-core" />
          </div>
          <div className="space-y-4">
            <p className="pill mx-auto w-fit">AI dating, with a vibe check first</p>
            <h1
              id="home-title"
              className="text-5xl font-black leading-[0.95] tracking-[-0.05em] text-white"
            >
              Let your AI<br />check the vibe first.
            </h1>
            <p className="mx-auto max-w-[28ch] text-base leading-7 text-white/68">
              Build your profile in a quick voice chat. Your agent runs a virtual date before you spend energy on a real one.
            </p>
          </div>
        </section>

        <div className="space-y-3">
          <Link href="/voice-onboarding" className="primary-button w-full">
            Get started
          </Link>
          <p className="text-center text-xs text-white/52">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-white underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </PhoneShell>
  );
}
