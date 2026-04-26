"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileCard } from "@/components/ProfileCard";
import { AppHeader } from "@/components/AppHeader";
import { PhoneShell } from "@/components/PhoneShell";
import { sampleProfiles } from "@/lib/data/sampleProfiles";
import { runVirtualDateSimulation } from "@/lib/matching/virtualDate";
import { loadProfile, saveResult, syncResultToServer } from "@/lib/storage";
import { RomanticProfile } from "@/lib/types/matching";

export default function DemoPage() {
  const router = useRouter();
  const [profile] = useState<RomanticProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return loadProfile();
  });
  const [selectedId, setSelectedId] = useState(sampleProfiles[0].id);

  useEffect(() => {
    if (!profile) {
      router.replace("/onboarding");
    }
  }, [profile, router]);

  const counterpart = useMemo(
    () => sampleProfiles.find((candidate) => candidate.id === selectedId) ?? sampleProfiles[0],
    [selectedId],
  );

  function runSimulation() {
    if (!profile) return;
    const result = runVirtualDateSimulation(profile, counterpart);
    saveResult(result);
    syncResultToServer(result);
    router.push("/results");
  }

  return (
    <PhoneShell label="Sample virtual introduction">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-6 pb-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Sample match</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Run a virtual introduction</h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Pick a sample profile, then run the six-round protocol between your saved profile and the sample.
          </p>
        </header>

        <section className="space-y-4" aria-labelledby="your-profile-heading">
          <h2 id="your-profile-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            Your saved profile
          </h2>
          {profile ? (
            <ProfileCard profile={profile} title="You" subtitle="Loaded from this device" />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Loading profile…</p>
          )}
        </section>

        <section className="card-obsidian space-y-4" aria-labelledby="counterpart-heading">
          <h2 id="counterpart-heading" className="text-sm font-semibold text-[var(--text-primary)]">
            Sample counterpart
          </h2>
          <label className="block text-sm text-[var(--text-secondary)]">
            Choose a sample profile
            <select
              className="input-obsidian mt-2"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {sampleProfiles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.agentType === "hosted" ? "Hosted agent" : "External mock agent"}
                </option>
              ))}
            </select>
          </label>
          <ProfileCard profile={counterpart} title="Counterpart preview" compact />
          <button
            type="button"
            onClick={runSimulation}
            disabled={!profile}
            className="btn-primary w-full touch-target disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run virtual introduction
          </button>
        </section>
      </div>
    </PhoneShell>
  );
}
