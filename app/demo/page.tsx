"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneShell } from "@/components/PhoneShell";
import { ProfileCard } from "@/components/ProfileCard";
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
    document.title = "Run a virtual date · wtfradar";
  }, []);

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
    <PhoneShell>
      <main className="screen-padding space-y-6">
        <header className="space-y-4">
          <Link href="/" className="text-sm font-bold text-white/58">wtfradar</Link>
          <p className="pill w-fit">Agent match demo</p>
          <h1 className="text-4xl font-black leading-none tracking-[-0.045em] text-white">Run a virtual date</h1>
          <p className="text-sm leading-6 text-white/66">Choose a counterpart profile. Both personal agents then run a six-round conversation and explain the outcome.</p>
        </header>

        <section aria-labelledby="profiles-title" className="space-y-4">
          <h2 id="profiles-title" className="sr-only">Profiles for the virtual date</h2>
          {profile ? <ProfileCard profile={profile} title="Your Profile" subtitle="Loaded from localStorage" /> : null}
          <div className="obsidian-card space-y-4 rounded-[28px] p-5">
            <label className="grid gap-2 text-sm font-bold text-white/84">
              Choose counterpart
              <select
                className="field text-sm"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {sampleProfiles.map((option) => (
                  <option key={option.id} value={option.id}>{option.name} - {option.agentType === "hosted" ? "Hosted" : "External demo"}</option>
                ))}
              </select>
            </label>
            <ProfileCard profile={counterpart} title="Counterpart" compact />
            <button
              onClick={runSimulation}
              disabled={!profile}
              className="primary-button w-full"
            >
              Run virtual date
            </button>
          </div>
        </section>
      </main>
    </PhoneShell>
  );
}
