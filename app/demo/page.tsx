"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileCard } from "@/components/ProfileCard";
import { sampleProfiles } from "@/lib/data/sampleProfiles";
import { runVirtualDateSimulation } from "@/lib/matching/virtualDate";
import { loadProfile, saveResult } from "@/lib/storage";
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
    router.push("/results");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Demo Match</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Run a virtual date simulation</h1>
          <p className="text-sm text-zinc-600">Choose a counterpart profile, then let both personal agents run the six-round protocol.</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          {profile ? <ProfileCard profile={profile} title="Your Profile" subtitle="Loaded from localStorage" /> : null}
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <label className="text-sm font-medium text-zinc-800">
              Choose counterpart
              <select
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {sampleProfiles.map((option) => (
                  <option key={option.id} value={option.id}>{option.name} · {option.agentType === "hosted" ? "Hosted" : "External/Mock"}</option>
                ))}
              </select>
            </label>
            <ProfileCard profile={counterpart} title="Counterpart" compact />
            <button
              onClick={runSimulation}
              disabled={!profile}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              Run Virtual Date
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
