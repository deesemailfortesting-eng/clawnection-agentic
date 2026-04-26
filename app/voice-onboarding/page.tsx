"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
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

export default function VoiceOnboardingPage() {
  const router = useRouter();
  const vapiRef = useRef<Vapi | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    if (!apiKey) {
      setError("Voice onboarding is not configured. NEXT_PUBLIC_VAPI_API_KEY is missing.");
      return;
    }

    vapiRef.current = new Vapi(apiKey);
    const vapi = vapiRef.current;

    vapi.on("call-start", () => setIsCallActive(true));

    vapi.on("call-end", () => {
      setIsCallActive(false);
      processAndSaveProfile(profileRef.current);
    });

    vapi.on("message", (message: any) => {
      const text = message.text || "";
      const jsonMatch = text.match(/PROFILE_DATA:\s*(\{.*\})/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          setProfile(data);
          profileRef.current = data;
        } catch {
          // malformed JSON from assistant — ignore
        }
      }
    });

    vapi.on("error", (err: any) => {
      console.error("Vapi error:", err);
      setIsCallActive(false);
    });

    return () => { vapi.stop(); };
  }, []);

  function processAndSaveProfile(data: ProfileData) {
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
  }

  async function startVoiceOnboarding() {
    if (!vapiRef.current) {
      setError("Vapi not initialized — check NEXT_PUBLIC_VAPI_API_KEY.");
      return;
    }
    if (!preCallData.name || !preCallData.gender || !preCallData.sexualPreference) {
      setError("Please fill in all fields before starting the call.");
      return;
    }

    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    if (!assistantId) {
      setError("Voice onboarding is not configured. NEXT_PUBLIC_VAPI_ASSISTANT_ID is missing.");
      return;
    }

    setError(null);

    // Auto-terminate after 30 minutes
    setTimeout(() => { vapiRef.current?.stop(); }, 30 * 60 * 1000);

    try {
      const firstMessage = `Hey ${preCallData.name} — Clawnection here. I can see from what you shared that you identify as ${preCallData.gender} and your sexual preference is ${preCallData.sexualPreference}. Before we get going, just so you know what this is: we're gonna talk for however long feels right. After this, I spin up a version of you that goes and chats with other people's agents — and when yours genuinely clicks with someone, we set up a real meet. So this is just… you and me, for a bit. No form, no right answers. Where are you right now — like, physically, what room are you in?`;
      await vapiRef.current.start(assistantId, { firstMessage });
      setShowPreCallForm(false);
    } catch (err) {
      setError("Failed to start the call. Check your Vapi credentials.");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Voice Onboarding</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Build your romance profile with voice</h1>
          <p className="text-sm leading-6 text-zinc-600">
            Chat with our AI assistant to create your profile. Just speak naturally — we'll guide you through everything.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          {showPreCallForm && !isCallActive && !isComplete && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-zinc-900 mb-2">Before we start chatting…</h2>
                <p className="text-sm text-zinc-600">This helps our AI assistant have a more personalised conversation.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">What's your name?</span>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    value={preCallData.name}
                    onChange={(e) => setPreCallData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Enter your name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">What's your gender?</span>
                  <select
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    value={preCallData.gender}
                    onChange={(e) => setPreCallData((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="">Select your gender</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">What's your sexual preference?</span>
                  <select
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    value={preCallData.sexualPreference}
                    onChange={(e) => setPreCallData((p) => ({ ...p, sexualPreference: e.target.value }))}
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
                onClick={startVoiceOnboarding}
                disabled={!preCallData.name || !preCallData.gender || !preCallData.sexualPreference}
                className="w-full rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Start Voice Chat
              </button>

              <p className="text-center text-xs text-zinc-500">
                Automatically ends after 30 minutes. You can end early at any time.
              </p>
            </div>
          )}

          {isCallActive && (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
                <p className="text-sm font-medium text-zinc-900">Call in progress</p>
              </div>
              <p className="text-sm text-zinc-600">
                Speak naturally. We'll collect your profile information through conversation.
              </p>
              <button
                onClick={() => vapiRef.current?.stop()}
                className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-300"
              >
                End Call
              </button>
            </div>
          )}

          {isComplete && (
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <p className="text-sm font-medium text-zinc-900">Profile created and saved!</p>
              </div>
              <p className="text-sm text-zinc-600">Redirecting to the demo…</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-500">
          Prefer to fill out the form manually?{" "}
          <a href="/onboarding" className="text-rose-500 hover:text-rose-600">
            Go to text onboarding
          </a>
        </p>
      </div>
    </main>
  );
}
