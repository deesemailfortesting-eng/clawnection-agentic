"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompatibilityScore } from "@/components/CompatibilityScore";
import { PhoneShell } from "@/components/PhoneShell";
import { ProfileCard } from "@/components/ProfileCard";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import { VirtualDateRoundCard } from "@/components/VirtualDateRoundCard";
import { loadResult } from "@/lib/storage";
import { MatchResult } from "@/lib/types/matching";

export default function ResultsPage() {
  const router = useRouter();
  const [result] = useState<MatchResult | null>(() => {
    if (typeof window === "undefined") return null;
    return loadResult();
  });

  useEffect(() => {
    document.title = "Virtual date results · wtfradar";
    if (!result) {
      router.replace("/demo");
    }
  }, [result, router]);

  if (!result) {
    return (
      <PhoneShell>
        <main className="screen-padding" />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <main className="screen-padding space-y-6">
        <header className="space-y-3">
          <Link href="/" className="text-sm font-bold text-white/58">wtfradar</Link>
          <p className="pill w-fit">Virtual date results</p>
          <h1 className="text-4xl font-black leading-none tracking-[-0.045em] text-white">
            {result.profileA.name} × {result.profileB.name}
          </h1>
          <RecommendationBadge recommendation={result.recommendation} />
          <p className="text-sm leading-6 text-white/66">{result.recommendation.rationale}</p>
        </header>

        <section aria-labelledby="score-title" className="grid gap-4">
          <CompatibilityScore score={result.compatibilityScore} />
          <div className="obsidian-card rounded-[28px] p-5">
            <h2 id="score-title" className="text-lg font-black text-white">First-date suggestion</h2>
            <p className="mt-2 text-base font-bold text-white">{result.firstDateSuggestion.idea}</p>
            <p className="mt-2 text-sm leading-6 text-white/64">{result.firstDateSuggestion.whyItFits}</p>
            <p className="mt-1 text-sm text-white/48">{result.firstDateSuggestion.logisticsNote}</p>
          </div>
        </section>

        <section aria-labelledby="participant-title" className="grid gap-4">
          <h2 id="participant-title" className="text-2xl font-black tracking-tight text-white">Profiles compared</h2>
          <ProfileCard profile={result.profileA} title="Participant A" compact />
          <ProfileCard profile={result.profileB} title="Participant B" compact />
        </section>

        <section aria-labelledby="summary-title" className="grid gap-4">
          <h2 id="summary-title" className="text-2xl font-black tracking-tight text-white">Plain-language summary</h2>
          <article className="rounded-[28px] border border-[rgba(216,191,65,0.30)] bg-[rgba(216,191,65,0.10)] p-5">
            <h3 className="text-lg font-black text-white">Top strengths</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/72">
              {result.strengths.map((strength) => (
                <li key={strength}>{strength}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-[28px] border border-[rgba(216,130,170,0.30)] bg-[rgba(216,130,170,0.10)] p-5">
            <h3 className="text-lg font-black text-white">Top concerns</h3>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-white/72">
              {result.concerns.length === 0 ? <li>No major concerns detected in this simulation.</li> : null}
              {result.concerns.map((concern) => (
                <li key={concern.title}>
                  <p className="font-bold text-white">{concern.title} <span className="text-xs text-white/48">({concern.severity})</span></p>
                  <p>{concern.detail}</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section aria-labelledby="transcript-title" className="space-y-3">
          <h2 id="transcript-title" className="text-2xl font-black tracking-tight text-white">Round-by-round transcript summary</h2>
          <div className="grid gap-3">
            {result.rounds.map((round) => (
              <VirtualDateRoundCard key={round.title} round={round} />
            ))}
          </div>
          <article className="obsidian-card rounded-[28px] p-5">
            <h3 className="text-base font-black text-white">Closing assessment</h3>
            <p className="mt-2 text-sm leading-6 text-white/66">{result.closingAssessment}</p>
          </article>
        </section>

        <section
          aria-label="Human choice reminder"
          className="rounded-[28px] p-5"
          style={{
            background: "rgba(216, 130, 170, 0.10)",
            border: "1px solid rgba(216, 130, 170, 0.30)",
          }}
        >
          <p className="text-sm leading-6 text-[var(--color-text-primary)]">
            Agents provide recommendations, not decisions. Final choice always belongs to both people.
          </p>
        </section>

        <div className="grid gap-3">
          <Link href="/demo" className="primary-button">
            Run another virtual date
          </Link>
          <Link href="/onboarding" className="secondary-button">
            Edit my profile
          </Link>
        </div>
      </main>
    </PhoneShell>
  );
}
