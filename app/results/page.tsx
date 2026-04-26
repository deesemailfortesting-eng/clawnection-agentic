"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompatibilityScore } from "@/components/CompatibilityScore";
import { PhoneShell } from "@/components/PhoneShell";
import { ProfileCard } from "@/components/ProfileCard";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import { VirtualDateRoundCard } from "@/components/VirtualDateRoundCard";
import { AppHeader } from "@/components/AppHeader";
import { loadResult, loadResultFromServer } from "@/lib/storage";
import { MatchResult } from "@/lib/types/matching";

function scoreNarration(score: number): string {
  if (score >= 75) {
    return "The numeric score is in the high range, which usually means strong alignment on stated values, lifestyle, and communication style in this simulation.";
  }
  if (score >= 55) {
    return "The numeric score is in the middle range. There is meaningful overlap, but the written concerns below are worth reading before you decide.";
  }
  return "The numeric score is in the lower range for this simulation. Read the concerns and strengths together; the number alone does not capture context.";
}

export default function ResultsPage() {
  const router = useRouter();
  const [resultId, setResultId] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(() => {
    if (typeof window === "undefined") return null;
    return loadResult();
  });
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setResultId(params.get("resultId"));
  }, []);

  useEffect(() => {
    document.title = "Virtual date results · wtfradar";

    let cancelled = false;

    async function restoreResult() {
      const cachedResult = typeof window === "undefined" ? null : loadResult();

      if (cachedResult) {
        setResult(cachedResult);
      }

      if (resultId) {
        const serverResult = await loadResultFromServer(resultId);
        if (cancelled) return;
        if (serverResult) {
          setResult(serverResult);
          setIsRestoring(false);
          return;
        }
      }

      if (cachedResult) {
        setIsRestoring(false);
        return;
      }

      setIsRestoring(false);
      router.replace("/demo");
    }

    void restoreResult();

    return () => {
      cancelled = true;
    };
  }, [resultId, router]);

  if (!result) {
    return (
      <PhoneShell label="Loading results">
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">
          {isRestoring ? "Loading results…" : "No results found."}
        </p>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell label="Virtual introduction results">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-6 pb-10">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Results</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {result.profileA.name} and {result.profileB.name}
          </h1>
          <RecommendationBadge recommendation={result.recommendation} />
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{result.recommendation.rationale}</p>
        </header>

        <section className="space-y-4" aria-labelledby="score-heading">
          <h2 id="score-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            Compatibility summary
          </h2>
          <CompatibilityScore score={result.compatibilityScore} narration={scoreNarration(result.compatibilityScore)} />
          <article className="card-obsidian">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">First date idea</h3>
            <p className="mt-2 text-base font-medium text-[var(--text-primary)]">{result.firstDateSuggestion.idea}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{result.firstDateSuggestion.whyItFits}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{result.firstDateSuggestion.logisticsNote}</p>
          </article>
        </section>

        <section className="space-y-3" aria-labelledby="profiles-heading">
          <h2 id="profiles-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            Profiles in this run
          </h2>
          <div className="space-y-4">
            <ProfileCard profile={result.profileA} title="Participant A" compact />
            <ProfileCard profile={result.profileB} title="Participant B" compact />
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="signals-heading">
          <h2 id="signals-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            Strengths and concerns
          </h2>
          <div className="space-y-4">
            <article className="card-obsidian border-emerald-500/25">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Top strengths</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {result.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </article>
            <article className="card-obsidian border-amber-500/25">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Top concerns</h3>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {result.concerns.length === 0 ? <li>No major concerns surfaced in this simulation.</li> : null}
                {result.concerns.map((concern) => (
                  <li key={concern.title}>
                    <p className="font-medium text-[var(--text-primary)]">
                      {concern.title}{" "}
                      <span className="text-xs font-normal text-[var(--text-muted)]">({concern.severity})</span>
                    </p>
                    <p>{concern.detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="rounds-heading">
          <h2 id="rounds-heading" className="text-base font-semibold text-[var(--text-primary)]">
            Round-by-round summary
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Each card is a text summary of that round. There is no separate audio or video recording in this prototype.
          </p>
          <div className="space-y-3">
            {result.rounds.map((round) => (
              <VirtualDateRoundCard key={round.title} round={round} />
            ))}
          </div>
          <article className="card-obsidian">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Closing assessment</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{result.closingAssessment}</p>
          </article>
        </section>

        <section className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4" aria-labelledby="human-loop-heading">
          <h2 id="human-loop-heading" className="sr-only">
            Human control reminder
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            Agents provide recommendations, not decisions. The final choice always belongs to both people involved.
          </p>
        </section>

        <nav className="flex flex-col gap-3" aria-label="Results next steps">
          <Link href="/demo" className="btn-primary touch-target text-center no-underline">
            Run another sample introduction
          </Link>
          <Link href="/onboarding" className="btn-secondary touch-target text-center no-underline">
            Edit profile using the form
          </Link>
        </nav>
      </div>
    </PhoneShell>
  );
}
