"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompatibilityScore } from "@/components/CompatibilityScore";
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
    if (!result) {
      router.replace("/demo");
    }
  }, [result, router]);

  if (!result) {
    return <main className="min-h-screen bg-zinc-50" />;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Virtual Date Results</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            {result.profileA.name} × {result.profileB.name}
          </h1>
          <RecommendationBadge recommendation={result.recommendation} />
          <p className="text-sm text-zinc-600">{result.recommendation.rationale}</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <CompatibilityScore score={result.compatibilityScore} />
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">First-date suggestion</p>
            <p className="mt-2 text-base font-medium text-zinc-900">{result.firstDateSuggestion.idea}</p>
            <p className="mt-2 text-sm text-zinc-600">{result.firstDateSuggestion.whyItFits}</p>
            <p className="mt-1 text-sm text-zinc-500">{result.firstDateSuggestion.logisticsNote}</p>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <ProfileCard profile={result.profileA} title="Participant A" compact />
          <ProfileCard profile={result.profileB} title="Participant B" compact />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Top strengths</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
              {result.strengths.map((strength) => (
                <li key={strength}>{strength}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Top concerns</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              {result.concerns.length === 0 ? <li>No major concerns detected in this simulation.</li> : null}
              {result.concerns.map((concern) => (
                <li key={concern.title}>
                  <p className="font-medium text-zinc-900">{concern.title} <span className="text-xs text-zinc-500">({concern.severity})</span></p>
                  <p>{concern.detail}</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-zinc-900">Round-by-round transcript summary</h2>
          <div className="grid gap-3">
            {result.rounds.map((round) => (
              <VirtualDateRoundCard key={round.title} round={round} />
            ))}
          </div>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900">Closing assessment</h3>
            <p className="mt-2 text-sm text-zinc-700">{result.closingAssessment}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm text-rose-900">
            Human-in-the-loop reminder: agents provide recommendations, not decisions. Final choice always belongs to both humans.
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/demo" className="rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-700">
            Run Another Match
          </Link>
          <Link href="/onboarding" className="rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-800 transition hover:border-zinc-800">
            Edit Profile
          </Link>
        </div>
      </div>
    </main>
  );
}
