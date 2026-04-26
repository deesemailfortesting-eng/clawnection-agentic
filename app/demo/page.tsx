"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneShell } from "@/components/PhoneShell";
import { ProfileCard } from "@/components/ProfileCard";
import { sampleProfiles, SAM_PROFILE_ID } from "@/lib/data/sampleProfiles";
import { runVirtualDateSimulation } from "@/lib/matching/virtualDate";
import { loadProfile, loadProfileFromServer, loadSignalsFromServer, saveResult, syncResultToServer } from "@/lib/storage";
import { RomanticProfile } from "@/lib/types/matching";
import { VoicePersona } from "@/lib/types/persona";

// ---------------------------------------------------------------------------
// Persona enrichment — fills sparse voice-onboarded profiles from VAPI output
// ---------------------------------------------------------------------------

function extractBullets(text: string, sectionPattern: RegExp): string[] {
  const lines = text.split("\n");
  const results: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (sectionPattern.test(line)) { inSection = true; continue; }
    if (/^##/.test(line) && inSection) break;
    if (inSection) {
      const m = line.match(/^[-•*]\s*(.+)/);
      if (m) results.push(m[1].trim().toLowerCase());
    }
  }
  return results;
}

function enrichFromPersona(profile: RomanticProfile, persona: VoicePersona): RomanticProfile {
  const signals = persona.structured_signals ?? "";
  const interests = extractBullets(signals, /##\s*(interests|hobbies|activities)/i);
  const values = extractBullets(signals, /##\s*(values|principles|priorities)/i);
  return {
    ...profile,
    bio: profile.bio || persona.portrait || profile.bio,
    interests: interests.length > 0 ? interests : profile.interests,
    values: values.length > 0 ? values : profile.values,
  };
}

async function fetchPersona(profileId: string): Promise<VoicePersona | null> {
  try {
    const res = await fetch(`/api/profiles/${encodeURIComponent(profileId)}/persona`);
    if (!res.ok) return null;
    return res.json() as Promise<VoicePersona>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<RomanticProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return loadProfile();
  });
  const [persona, setPersona] = useState<VoicePersona | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [selectedId, setSelectedId] = useState(sampleProfiles[0].id);

  // Detect if we arrived from the voice-onboarding persona page
  const isPersonaMode = Boolean(profileId);

  useEffect(() => {
    document.title = "Run a virtual date · wtfradar";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("profileId");
    setProfileId(id);
    if (id) {
      // Pre-select Sam when arriving from voice onboarding
      setSelectedId(SAM_PROFILE_ID);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSavedState() {
      const cachedProfile = typeof window === "undefined" ? null : loadProfile();
      const requestedProfileId = profileId ?? cachedProfile?.id ?? null;

      if (cachedProfile) setProfile(cachedProfile);

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
    return () => { cancelled = true; };
  }, [profileId, router]);

  // Fetch voice persona when in persona mode
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    fetchPersona(profileId).then((p) => {
      if (!cancelled) setPersona(p);
    });
    return () => { cancelled = true; };
  }, [profileId]);

  const counterpart = useMemo(
    () => sampleProfiles.find((c) => c.id === selectedId) ?? sampleProfiles[0],
    [selectedId],
  );

  async function runSimulation() {
    if (!profile) return;
    const enriched = persona ? enrichFromPersona(profile, persona) : profile;
    const result = runVirtualDateSimulation(enriched, counterpart);
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
          <h1 className="text-4xl font-black leading-none tracking-[-0.045em] text-white">
            {isPersonaMode ? "Meet Sam" : "Run a virtual date"}
          </h1>
          <p className="text-sm leading-6 text-white/66">
            {isPersonaMode
              ? "Your personal agent runs a six-round conversation with Sam's agent and explains the outcome."
              : "Choose a counterpart profile. Both personal agents then run a six-round conversation and explain the outcome."}
          </p>
        </header>

        <section aria-labelledby="profiles-title" className="space-y-4">
          <h2 id="profiles-title" className="sr-only">Profiles for the virtual date</h2>

          {/* User profile card — show persona portrait if available */}
          {profile ? (
            persona && persona.portrait ? (
              <article className="obsidian-card rounded-[28px] p-5 space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/44">Your agent persona</p>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-2xl font-black tracking-tight text-white">{profile.name}, {profile.age}</h3>
                  <span className="pill shrink-0">Hosted</span>
                </div>
                <p className="text-sm leading-6 text-white/72">{persona.portrait}</p>
              </article>
            ) : (
              <ProfileCard profile={profile} title="Your profile" subtitle="Loaded from saved state" />
            )
          ) : null}

          {/* Counterpart — Sam in persona mode, picker otherwise */}
          {isPersonaMode ? (
            <article className="obsidian-card rounded-[28px] p-5 space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/44">Counterpart agent</p>
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-black tracking-tight text-white">{counterpart.name}, {counterpart.age}</h3>
                <span className="pill shrink-0">Hosted</span>
              </div>
              <p className="text-sm leading-6 text-white/72">{counterpart.bio}</p>
              <div className="grid gap-1 text-sm text-white/60">
                <p><span className="font-bold text-white">Loves:</span> {counterpart.interests.slice(0, 4).join(", ")}</p>
                <p><span className="font-bold text-white">Values:</span> {counterpart.values.slice(0, 3).join(", ")}</p>
              </div>
            </article>
          ) : (
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
            </div>
          )}

          <button
            onClick={runSimulation}
            disabled={!profile || isRestoring}
            className="primary-button w-full"
          >
            {isRestoring ? "Restoring saved state…" : isPersonaMode ? `Run date with ${counterpart.name}` : "Run virtual date"}
          </button>
        </section>
      </main>
    </PhoneShell>
  );
}
