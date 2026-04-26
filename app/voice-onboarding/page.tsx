"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { PhoneShell } from "@/components/PhoneShell";
import { saveProfile, syncProfileToServer } from "@/lib/storage";
import { CommunicationStyle, RelationshipIntent, RomanticProfile } from "@/lib/types/matching";

type ProfileData = {
  name?: string;
  age?: number;
  genderIdentity?: string;
  lookingFor?: string;
  location?: string;
  relationshipIntent?: RelationshipIntent;
  bio?: string;
  interests?: string[];
  values?: string[];
  communicationStyle?: CommunicationStyle;
  sleepSchedule?: RomanticProfile["lifestyleHabits"]["sleepSchedule"];
  socialEnergy?: RomanticProfile["lifestyleHabits"]["socialEnergy"];
  activityLevel?: RomanticProfile["lifestyleHabits"]["activityLevel"];
  drinking?: RomanticProfile["lifestyleHabits"]["drinking"];
  smoking?: RomanticProfile["lifestyleHabits"]["smoking"];
  dealbreakers?: string[];
  idealFirstDate?: string;
  preferenceMinAge?: number;
  preferenceMaxAge?: number;
  preferenceNotes?: string;
  agentType?: RomanticProfile["agentType"];
};

const fieldClass = "field mt-2 text-sm";
const labelClass = "grid gap-1 text-sm font-bold text-white/84";
const vapiApiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const vapiAssistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

function messageText(message: unknown): string {
  if (typeof message !== "object" || message === null || !("text" in message)) return "";
  const text = (message as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

export default function VoiceOnboardingPage() {
  const router = useRouter();
  const vapiRef = useRef<Vapi | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    vapiApiKey ? null : "Voice onboarding is not configured. NEXT_PUBLIC_VAPI_API_KEY is missing.",
  );
  const [preCallData, setPreCallData] = useState({
    name: "",
    gender: "",
    sexualPreference: "",
  });
  const [showPreCallForm, setShowPreCallForm] = useState(true);

  // Stable ref so processAndSaveProfile always sees latest profile state
  const profileRef = useRef<ProfileData>({});

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const processAndSaveProfile = useCallback((data: ProfileData) => {
    if (!data.name || !data.age || !data.location || !data.bio) return;

    const romanticProfile: RomanticProfile = {
      id: `voice-${crypto.randomUUID()}`,
      name: data.name,
      age: data.age,
      genderIdentity: data.genderIdentity || "",
      lookingFor: data.lookingFor || "",
      location: data.location,
      relationshipIntent: data.relationshipIntent || "long-term",
      bio: data.bio,
      interests: data.interests || [],
      values: data.values || [],
      communicationStyle: data.communicationStyle || "balanced",
      lifestyleHabits: {
        sleepSchedule: data.sleepSchedule || "flexible",
        socialEnergy: data.socialEnergy || "balanced",
        activityLevel: data.activityLevel || "active",
        drinking: data.drinking || "social",
        smoking: data.smoking || "never",
      },
      dealbreakers: data.dealbreakers || [],
      idealFirstDate: data.idealFirstDate || "",
      preferenceAgeRange: {
        min: data.preferenceMinAge || 24,
        max: data.preferenceMaxAge || 38,
      },
      preferenceNotes: data.preferenceNotes || "",
      agentType: data.agentType || "hosted",
    };

    saveProfile(romanticProfile);
    // Persist to Cloudflare D1 in the background
    syncProfileToServer(romanticProfile);
    setIsComplete(true);
    setTimeout(() => router.push("/demo"), 2000);
  }, [router]);

  useEffect(() => {
    document.title = "Voice onboarding · wtfradar";
    if (!vapiApiKey) return;

    vapiRef.current = new Vapi(vapiApiKey);
    const vapi = vapiRef.current;

    vapi.on("call-start", () => setIsCallActive(true));

    vapi.on("call-end", () => {
      setIsCallActive(false);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      processAndSaveProfile(profileRef.current);
    });

    vapi.on("message", (message: unknown) => {
      const text = messageText(message);
      const jsonMatch = text.match(/PROFILE_DATA:\s*(\{.*\})/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          setProfile(data);
          profileRef.current = data;
        } catch {
          // Ignore malformed assistant JSON; the call can continue safely.
        }
      }
    });

    vapi.on("error", (err: unknown) => {
      console.error("Vapi error:", err);
      setIsCallActive(false);
      setError("The voice call stopped unexpectedly. You can try again or use text onboarding.");
    });

    return () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      vapi.stop();
    };
  }, [processAndSaveProfile]);

  async function startVoiceOnboarding() {
    if (!vapiRef.current) {
      setError("Voice onboarding is not initialized. Check NEXT_PUBLIC_VAPI_API_KEY.");
      return;
    }
    if (!preCallData.name || !preCallData.gender || !preCallData.sexualPreference) {
      setError("Please fill in all fields before starting the call.");
      return;
    }

    if (!vapiAssistantId) {
      setError("Voice onboarding is not configured. NEXT_PUBLIC_VAPI_ASSISTANT_ID is missing.");
      return;
    }

    setError(null);

    // Auto-terminate after 30 minutes so microphone access cannot remain open indefinitely.
    callTimeoutRef.current = setTimeout(() => { vapiRef.current?.stop(); }, 30 * 60 * 1000);

    try {
      const firstMessage = `Hey ${preCallData.name}. This is wtfradar. You shared that you identify as ${preCallData.gender} and your dating preference is ${preCallData.sexualPreference}. We will have a guided conversation to build your dating profile. After this, your agent can chat with other agents in a virtual date before you decide whether to meet someone. There are no right answers. To begin, where are you right now, like what room are you in?`;
      await vapiRef.current.start(vapiAssistantId, { firstMessage });
      setShowPreCallForm(false);
    } catch {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      setError("Failed to start the call. Check your Vapi credentials.");
    }
  }

  return (
    <PhoneShell>
      <main className="screen-padding space-y-6">
        <header className="space-y-4">
          <Link href="/" className="text-sm font-bold text-white/58">wtfradar</Link>
          <p className="pill w-fit">Voice onboarding</p>
          <h1 className="text-4xl font-black leading-none tracking-[-0.045em] text-white">Build your profile by voice</h1>
          <p className="text-sm leading-6 text-white/66">
            Talk with the wtfradar assistant to create your dating profile. Every spoken instruction is also summarized on this screen.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-300/40 bg-red-500/12 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <section aria-labelledby="voice-status-title" className="obsidian-card rounded-[30px] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="voice-status-title" className="text-xl font-black text-white">Microphone status</h2>
              <p className="mt-1 text-sm leading-6 text-white/62">
                {isCallActive ? "Your microphone is active for the onboarding call." : "Your microphone is off."}
              </p>
            </div>
            <div
              aria-hidden="true"
              className={`mt-1 h-5 w-5 rounded-full ${isCallActive ? "animate-pulse bg-emerald-400 shadow-[0_0_26px_rgba(52,211,153,0.8)]" : "bg-white/18"}`}
            />
          </div>
          <p role="status" aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white">
            {isCallActive ? "Microphone active. The assistant can hear you now." : "Microphone inactive. Start the call when you are ready."}
          </p>
        </section>

        <section aria-labelledby="voice-flow-title" className="obsidian-card rounded-[30px] p-5">
          {showPreCallForm && !isCallActive && !isComplete && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 id="voice-flow-title" className="text-xl font-black text-white">Before the call</h2>
                <p className="text-sm leading-6 text-white/64">
                  These details help the assistant start respectfully. You can end the call at any time.
                </p>
              </div>

              <div className="space-y-4">
                <label className={labelClass}>
                  What is your name?
                  <input
                    type="text"
                    className={fieldClass}
                    value={preCallData.name}
                    onChange={(e) => setPreCallData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Enter your name"
                    required
                  />
                </label>

                <label className={labelClass}>
                  What is your gender?
                  <select
                    className={fieldClass}
                    value={preCallData.gender}
                    onChange={(e) => setPreCallData((p) => ({ ...p, gender: e.target.value }))}
                    required
                  >
                    <option value="">Select your gender</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </label>

                <label className={labelClass}>
                  What is your dating preference?
                  <select
                    className={fieldClass}
                    value={preCallData.sexualPreference}
                    onChange={(e) => setPreCallData((p) => ({ ...p, sexualPreference: e.target.value }))}
                    required
                  >
                    <option value="">Select your preference</option>
                    <option value="straight">Straight</option>
                    <option value="gay">Gay</option>
                    <option value="lesbian">Lesbian</option>
                    <option value="bisexual">Bisexual</option>
                    <option value="pansexual">Pansexual</option>
                    <option value="asexual">Asexual</option>
                    <option value="queer">Queer</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={startVoiceOnboarding}
                disabled={!preCallData.name || !preCallData.gender || !preCallData.sexualPreference}
                className="primary-button w-full"
              >
                Start voice onboarding
              </button>

              <p className="text-center text-xs leading-5 text-white/50">
                Automatically ends after 30 minutes. You can end early at any time.
              </p>
            </div>
          )}

          {isCallActive && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 id="voice-flow-title" className="text-xl font-black text-white">Call in progress</h2>
                <p className="text-sm leading-6 text-white/66">
                  Speak naturally. The assistant will ask about your location, values, interests, communication style, boundaries, and first-date preferences.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <h3 className="text-sm font-black text-white">Visual equivalent of the audio prompt</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  The assistant is guiding you through profile questions. If you miss a spoken prompt, ask it to repeat or summarize the question.
                </p>
              </div>
              <button
                type="button"
                onClick={() => vapiRef.current?.stop()}
                className="secondary-button w-full"
                aria-label="End voice onboarding call and turn off the microphone"
              >
                End call and turn off microphone
              </button>
            </div>
          )}

          {isComplete && (
            <div className="space-y-3 text-center">
              <h2 id="voice-flow-title" className="text-xl font-black text-white">Profile saved</h2>
              <p className="text-sm leading-6 text-white/66">Your profile is ready. Redirecting to the virtual date demo.</p>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-white/52">
          Prefer to fill out the form manually?{" "}
          <Link href="/onboarding" className="font-bold text-white underline underline-offset-4">
            Open text onboarding
          </Link>
        </p>
      </main>
    </PhoneShell>
  );
}
