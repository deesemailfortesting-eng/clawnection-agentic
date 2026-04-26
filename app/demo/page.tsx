"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileCard } from "@/components/ProfileCard";
import { AppHeader } from "@/components/AppHeader";
import { PhoneShell } from "@/components/PhoneShell";
import { sampleProfiles } from "@/lib/data/sampleProfiles";
import { runVirtualDateSimulation } from "@/lib/matching/virtualDate";
import { loadProfile, saveResult, syncResultToServer } from "@/lib/storage";
import { RomanticProfile, MatchResult } from "@/lib/types/matching";

type ProfileEntry = {
  profile: RomanticProfile;
  source: "d1" | "sample";
};

export default function DemoPage() {
  const router = useRouter();
  const [profile] = useState<RomanticProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return loadProfile();
  });

  const [entries, setEntries] = useState<ProfileEntry[]>([]);
  const [usingSamples, setUsingSamples] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      router.replace("/onboarding");
      return;
    }

    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data: { profiles?: RomanticProfile[] }) => {
        const realProfiles = (data.profiles ?? []).filter((p) => p.id !== profile.id);

        if (realProfiles.length > 0) {
          const d1Entries: ProfileEntry[] = realProfiles.map((p) => ({ profile: p, source: "d1" as const }));
          setEntries(d1Entries);
          setSelectedId(d1Entries[0].profile.id);
          setUsingSamples(false);
        } else {
          const sampleEntries: ProfileEntry[] = sampleProfiles.map((p) => ({ profile: p, source: "sample" as const }));
          setEntries(sampleEntries);
          setSelectedId(sampleEntries[0].profile.id);
          setUsingSamples(true);
        }
      })
      .catch(() => {
        const sampleEntries: ProfileEntry[] = sampleProfiles.map((p) => ({ profile: p, source: "sample" as const }));
        setEntries(sampleEntries);
        setSelectedId(sampleEntries[0].profile.id);
        setUsingSamples(true);
      });
  }, [profile, router]);

  const selected = useMemo(
    () => entries.find((e) => e.profile.id === selectedId) ?? entries[0],
    [entries, selectedId],
  );

  async function runMatch() {
    if (!profile || !selected) return;

    setLoading(true);
    setError(null);

    try {
      if (selected.source === "d1") {
        const res = await fetch("/api/scoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileAId: profile.id, profileBId: selected.profile.id }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Scoring request failed" }));
          throw new Error((err as { error?: string }).error ?? "Scoring request failed");
        }

        const data = await res.json();
        const result: MatchResult = {
          profileA: data.profileA,
          profileB: data.profileB,
          compatibilityScore: data.compatibilityScore,
          strengths: data.strengths,
          concerns: data.concerns,
          rounds: data.rounds,
          firstDateSuggestion: data.firstDateSuggestion,
          closingAssessment: data.closingAssessment,
          recommendation: data.recommendation,
        };
        saveResult(result);
      } else {
        const result = runVirtualDateSimulation(profile, selected.profile);
        saveResult(result);
        syncResultToServer(result);
      }

      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PhoneShell label="Sample virtual introduction">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-6 pb-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Sample match</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Run a virtual introduction</h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Pick a profile, then run the scoring protocol between your saved profile and the counterpart.
          </p>
        </header>

        <section className="space-y-4" aria-labelledby="your-profile-heading">
          <h2 id="your-profile-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            Your saved profile
          </h2>
          {profile ? (
            <ProfileCard profile={profile} title="You" subtitle="Loaded from this device" />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Loading profile...</p>
          )}
        </section>

        <section className="card-obsidian space-y-4" aria-labelledby="counterpart-heading">
          <h2 id="counterpart-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            {usingSamples ? "Sample counterpart" : "Choose a counterpart"}
          </h2>

          {usingSamples && (
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              No other users yet — showing sample profiles
            </p>
          )}

          {entries.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Loading profiles...</p>
          ) : (
            <>
              <label className="block text-sm text-[var(--text-secondary)]">
                Choose a profile
                <select
                  className="input-obsidian mt-2"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {entries.map((entry) => (
                    <option key={entry.profile.id} value={entry.profile.id}>
                      {entry.profile.name}
                      {entry.source === "d1" ? "" : " (sample)"}
                      {" · "}
                      {entry.profile.agentType === "hosted" ? "Hosted agent" : "External mock agent"}
                    </option>
                  ))}
                </select>
              </label>

              {selected && (
                <ProfileCard profile={selected.profile} title="Counterpart preview" compact />
              )}

              {error && (
                <p className="text-sm text-red-400" role="alert">{error}</p>
              )}

              <button
                type="button"
                onClick={runMatch}
                disabled={!profile || loading}
                className="btn-primary w-full touch-target disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Running match..." : "Run virtual introduction"}
              </button>
            </>
          )}
        </section>
      </div>
    </PhoneShell>
  );
}
