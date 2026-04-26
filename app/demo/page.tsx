"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileCard } from "@/components/ProfileCard";
import { AppHeader } from "@/components/AppHeader";
import { PhoneShell } from "@/components/PhoneShell";
import { sampleProfiles } from "@/lib/data/sampleProfiles";
import { runVirtualDateSimulation } from "@/lib/matching/virtualDate";
import {
  loadProfile,
  loadProfileFromServer,
  loadSignalsFromServer,
  saveResult,
  syncResultToServer,
} from "@/lib/storage";
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
            <p className="text-sm text-[var(--text-muted)]">
              {isRestoring ? "Restoring saved state…" : "Loading profile…"}
            </p>
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
            onClick={() => void runSimulation()}
            disabled={!profile || isRestoring}
            className="btn-primary w-full touch-target disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRestoring ? "Restoring saved state…" : "Run virtual introduction"}
          </button>
        </section>
      </div>
    </PhoneShell>
  );
}
