"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type StepId = "welcome" | "name" | "gender" | "preference" | "voice";

const STEP_ORDER: StepId[] = ["welcome", "name", "gender", "preference", "voice"];

const genderOptions = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Something else" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

const preferenceOptions = [
  { value: "straight", label: "Straight" },
  { value: "gay", label: "Gay" },
  { value: "lesbian", label: "Lesbian" },
  { value: "bisexual", label: "Bisexual" },
  { value: "pansexual", label: "Pansexual" },
  { value: "queer", label: "Queer" },
  { value: "asexual", label: "Asexual" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

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
  const profileRef = useRef<ProfileData>({});

  const [step, setStep] = useState<StepId>("welcome");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [preference, setPreference] = useState("");

  const [isCallActive, setIsCallActive] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [error, setError] = useState<string | null>(() =>
    vapiApiKey ? null : "Voice onboarding is not configured. NEXT_PUBLIC_VAPI_API_KEY is missing.",
  );

  const stepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    document.title = "Onboarding · wtfradar";
  }, []);

  const processAndSaveProfile = useCallback((data: ProfileData) => {
    if (!data.name || !data.age || !data.location || !data.bio) return;

    const romanticProfile: RomanticProfile = {
      id: `voice-${crypto.randomUUID()}`,
      name: data.name,
      age: data.age,
      genderIdentity: data.genderIdentity || gender,
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
    syncProfileToServer(romanticProfile);
    setIsComplete(true);
    setTimeout(() => router.push(`/demo?profileId=${encodeURIComponent(romanticProfile.id)}`), 1800);
  }, [gender, router]);

  useEffect(() => {
    if (!vapiApiKey) return;

    vapiRef.current = new Vapi(vapiApiKey);
    const vapi = vapiRef.current;

    vapi.on("call-start", () => setIsCallActive(true));

    vapi.on("call-end", () => {
      setIsCallActive(false);
      setIsAssistantSpeaking(false);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      processAndSaveProfile(profileRef.current);
    });

    vapi.on("speech-start", () => setIsAssistantSpeaking(true));
    vapi.on("speech-end", () => setIsAssistantSpeaking(false));

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
      setIsAssistantSpeaking(false);
      setError("The voice call stopped unexpectedly. Tap the orb to try again.");
    });

    return () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      vapi.stop();
    };
  }, [processAndSaveProfile]);

  function goNext() {
    setError(null);
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    setError(null);
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function startVoiceCall() {
    if (!vapiRef.current) {
      setError("Voice onboarding is not initialized. Check NEXT_PUBLIC_VAPI_API_KEY.");
      return;
    }
    if (!vapiAssistantId) {
      setError("Voice onboarding is not configured. NEXT_PUBLIC_VAPI_ASSISTANT_ID is missing.");
      return;
    }

    setError(null);
    callTimeoutRef.current = setTimeout(() => {
      vapiRef.current?.stop();
    }, 30 * 60 * 1000);

    try {
      const firstMessage = `Hey ${name}. This is wtfradar. You shared that you identify as ${gender} and your dating preference is ${preference}. We will have a guided conversation to build your dating profile. After this, your agent can chat with other agents in a virtual date before you decide whether to meet someone. There are no right answers. To begin, where are you right now, like what room are you in?`;
      await vapiRef.current.start(vapiAssistantId, { firstMessage });
    } catch {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      setError("Failed to start the call. Please try again.");
    }
  }

  function endVoiceCall() {
    vapiRef.current?.stop();
  }

  const continueDisabled =
    (step === "name" && !name.trim()) ||
    (step === "gender" && !gender) ||
    (step === "preference" && !preference);

  return (
    <PhoneShell>
      <main className="screen-padding flex min-h-dvh flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            {stepIndex > 0 && step !== "voice" && !isCallActive ? (
              <button
                type="button"
                onClick={goBack}
                className="text-sm font-bold text-white/68 hover:text-white"
                aria-label="Go back to the previous step"
              >
                ← Back
              </button>
            ) : (
              <Link href="/" className="text-sm font-bold text-white/58" aria-label="wtfradar home">
                wtfradar
              </Link>
            )}
            <span className="pill">
              Step {stepIndex + 1} of {STEP_ORDER.length}
            </span>
          </div>

          <div className="step-progress" aria-hidden="true">
            {STEP_ORDER.map((id, idx) => (
              <span
                key={id}
                data-state={idx < stepIndex ? "done" : idx === stepIndex ? "active" : "upcoming"}
              />
            ))}
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-300/40 bg-red-500/12 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {step === "welcome" && (
          <section className="flex flex-1 flex-col justify-between gap-8">
            <div className="space-y-5">
              <p className="pill w-fit">Welcome</p>
              <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.05em] text-white">
                Let&apos;s build your<br />wtf<span className="radar-text-gradient">radar</span> profile.
              </h1>
              <p className="text-base leading-7 text-white/70">
                A few quick taps, then a short voice chat with your AI assistant. No long forms — your agent learns you naturally.
              </p>
            </div>

            <div className="space-y-3">
              <button type="button" onClick={goNext} className="primary-button w-full">
                Get started
              </button>
              <p className="text-center text-xs text-white/52">
                Takes about a minute. End the voice call anytime.
              </p>
            </div>
          </section>
        )}

        {step === "name" && (
          <section className="flex flex-1 flex-col justify-between gap-8">
            <div className="space-y-5">
              <p className="pill w-fit">A bit about you</p>
              <h1 className="text-4xl font-black leading-[1] tracking-[-0.04em] text-white">
                What should we call you?
              </h1>
              <label className="grid gap-2 text-sm font-bold text-white/84">
                <span className="sr-only">Your first name</span>
                <input
                  className="field text-lg"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your first name"
                  autoFocus
                  autoComplete="given-name"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={continueDisabled}
              className="primary-button w-full"
            >
              Continue
            </button>
          </section>
        )}

        {step === "gender" && (
          <section className="flex flex-1 flex-col justify-between gap-8">
            <div className="space-y-5">
              <p className="pill w-fit">About you</p>
              <h1 className="text-4xl font-black leading-[1] tracking-[-0.04em] text-white">
                I am a...
              </h1>
              <p className="text-sm text-white/58">Pick the option that fits best — you can be more specific in the voice chat.</p>
              <div className="grid gap-3">
                {genderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="option-tile"
                    data-selected={gender === option.value}
                    onClick={() => setGender(option.value)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={continueDisabled}
              className="primary-button w-full"
            >
              Continue
            </button>
          </section>
        )}

        {step === "preference" && (
          <section className="flex flex-1 flex-col justify-between gap-8">
            <div className="space-y-5">
              <p className="pill w-fit">Who you&apos;re looking for</p>
              <h1 className="text-4xl font-black leading-[1] tracking-[-0.04em] text-white">
                I&apos;m attracted to...
              </h1>
              <p className="text-sm text-white/58">This helps your agent line up the right virtual dates.</p>
              <div className="grid gap-3">
                {preferenceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="option-tile"
                    data-selected={preference === option.value}
                    onClick={() => setPreference(option.value)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={continueDisabled}
              className="primary-button w-full"
            >
              Continue
            </button>
          </section>
        )}

        {step === "voice" && (
          <section className="flex flex-1 flex-col items-center justify-between gap-10 text-center">
            <div className="space-y-3">
              <p className="pill mx-auto w-fit">
                {isComplete ? "All set" : isCallActive ? "Listening" : "Voice chat"}
              </p>
              <h1 className="text-4xl font-black leading-[1] tracking-[-0.04em] text-white">
                {isComplete
                  ? "Profile saved."
                  : isCallActive
                    ? "Just speak naturally."
                    : `Ready, ${name || "friend"}?`}
              </h1>
              <p className="mx-auto max-w-[28ch] text-sm leading-6 text-white/66">
                {isComplete
                  ? "Heading to your virtual date demo…"
                  : isCallActive
                    ? "Your agent is listening. Tell it about your life, what you want, and what you avoid."
                    : "Tap the orb to start a short voice intro. End anytime."}
              </p>
            </div>

            <button
              type="button"
              onClick={isCallActive ? endVoiceCall : startVoiceCall}
              disabled={isComplete}
              className="voice-orb"
              data-active={isCallActive}
              aria-label={isCallActive ? "End voice call" : "Start voice call"}
            >
              <span className="voice-orb-ring" aria-hidden="true" />
              <span className="voice-orb-ring" aria-hidden="true" />
              <span className="voice-orb-ring" aria-hidden="true" />
              <span className="voice-orb-core" aria-hidden="true" />
              <span className="sr-only">
                {isCallActive ? "Voice call active. Tap to end." : "Tap to start voice call."}
              </span>
            </button>

            <div className="w-full space-y-3">
              <p
                role="status"
                aria-live="polite"
                className="text-xs font-bold uppercase tracking-[0.18em] text-white/52"
              >
                {isCallActive
                  ? isAssistantSpeaking
                    ? "Assistant speaking"
                    : "Microphone live"
                  : isComplete
                    ? "Saved"
                    : "Tap orb to begin"}
              </p>
              {isCallActive && (
                <button
                  type="button"
                  onClick={endVoiceCall}
                  className="secondary-button w-full"
                >
                  End call
                </button>
              )}
              {!isCallActive && !isComplete && (
                <p className="text-center text-xs text-white/48">
                  Auto-ends after 30 minutes. Prefer typing?{" "}
                  <Link href="/onboarding" className="font-bold text-white underline underline-offset-4">
                    Use the form
                  </Link>
                  .
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </PhoneShell>
  );
}
