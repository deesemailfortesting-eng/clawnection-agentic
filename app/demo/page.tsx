"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneShell } from "@/components/PhoneShell";
import { ProfileCard } from "@/components/ProfileCard";
import { sampleProfiles } from "@/lib/data/sampleProfiles";
import { runVirtualDateSimulation } from "@/lib/matching/virtualDate";
import { loadProfile, loadProfileFromServer, loadSignalsFromServer, saveResult, syncResultToServer } from "@/lib/storage";
import { RomanticProfile } from "@/lib/types/matching";

export default function DemoPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<RomanticProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return loadProfile();
  });
  const [isRestoring, setIsRestoring] = useState(true);
  const [selectedId, setSelectedId] = useState(sampleProfiles[0].id);

  useEffect(() => {
    document.title = "Run a virtual date · wtfradar";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setProfileId(params.get("profileId"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSavedState() {
      const cachedProfile = typeof window === "undefined" ? null : loadProfile();
      const requestedProfileId = profileId ?? cachedProfile?.id ?? null;

      if (cachedProfile) {
        setProfile(cachedProfile);
      }

      if (!requestedProfileId) {
        if (!cancelled) {
          setIsRestoring(false);
          router.replace("/onboarding");
        }
        return;
      }

      const [serverProfile] = await Promise.all([
        loadProfileFromServer(requestedProfileId),
        loadSignalsFromServer(requestedProfileId),
      ]);

      if (cancelled) return;

      if (serverProfile) {
        setProfile(serverProfile);
        setIsRestoring(false);
        return;
      }

      if (cachedProfile) {
        setIsRestoring(false);
        return;
      }

      setIsRestoring(false);
      router.replace("/onboarding");
    }

    void restoreSavedState();

    return () => {
      cancelled = true;
    };
  }, [profileId, router]);

  const counterpart = useMemo(
    () => sampleProfiles.find((candidate) => candidate.id === selectedId) ?? sampleProfiles[0],
    [selectedId],
  );

  async function runSimulation() {
    if (!profile) return;
    const result = runVirtualDateSimulation(profile, counterpart);
    saveResult(result);
    const resultId = await syncResultToServer(result);
    router.push(resultId ? `/results?resultId=${encodeURIComponent(resultId)}` : "/results");
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
          {profile ? <ProfileCard profile={profile} title="Your Profile" subtitle="Loaded from saved state" /> : null}
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
              disabled={!profile || isRestoring}
              className="primary-button w-full"
            >
              {isRestoring ? "Restoring saved state..." : "Run virtual date"}
            </button>
          </div>
        </section>
      </main>
    </PhoneShell>
  );
}
