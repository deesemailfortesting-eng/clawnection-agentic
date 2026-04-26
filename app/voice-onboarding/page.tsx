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

type BasicProfileForm = {
  name: string;
  age: string;
  genderIdentity: string;
  location: string;
  lookingFor: "Men" | "Women" | "Everyone";
};

const vapiApiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const vapiAssistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
const defaultBasicProfile: BasicProfileForm = {
  name: "",
  age: "",
  genderIdentity: "",
  location: "",
  lookingFor: "Everyone",
};

const basicProfileSteps = [
  {
    key: "name",
    eyebrow: "Step 1 of 5",
    title: "What's your first name?",
    help: "Use the name you want matches to see.",
  },
  {
    key: "age",
    eyebrow: "Step 2 of 5",
    title: "How old are you?",
    help: "You must be 18 or older to use wtfradar.",
  },
  {
    key: "genderIdentity",
    eyebrow: "Step 3 of 5",
    title: "How do you identify?",
    help: "Choose a quick option or type your own words.",
  },
  {
    key: "location",
    eyebrow: "Step 4 of 5",
    title: "What city are you based in right now?",
    help: "A city is enough. You can keep it broad.",
  },
  {
    key: "lookingFor",
    eyebrow: "Step 5 of 5",
    title: "Who would you like to meet?",
    help: "This helps your agent look in the right direction.",
  },
] as const;

function buildBioFirstMessage(name: string) {
  return `Last step, ${name}! Just talk to me for a few seconds about what you like to do, your hobbies, or what you're looking for, and I'll write a killer bio for you.`;
}

function buildBioSystemPrompt(basics: BasicProfileForm) {
  const profilePayload = {
    name: basics.name,
    age: Number(basics.age),
    genderIdentity: basics.genderIdentity,
    lookingFor: basics.lookingFor,
    location: basics.location,
    relationshipIntent: "exploring",
    bio: "Catchy bio you wrote",
    interests: [],
    values: [],
    communicationStyle: "balanced",
    sleepSchedule: "flexible",
    socialEnergy: "balanced",
    activityLevel: "active",
    drinking: "social",
    smoking: "never",
    dealbreakers: [],
    idealFirstDate: "",
    preferenceMinAge: 24,
    preferenceMaxAge: 38,
    preferenceNotes: "",
    agentType: "hosted",
  };

  return `# ROLE
You are a fast, friendly, and highly conversational AI onboarding assistant for wtfradar.

# MISSION
The normal form already collected the user's basics. Your only job is to collect short bio material and write a catchy dating bio.

# CONVERSATIONAL RULES
1. Ask exactly one question at a time.
2. Keep every response to 1-2 short sentences.
3. Sound natural and casual. Use brief acknowledgements like "Got it," "Awesome," or "Perfect."
4. Do not repeat everything the user says.
5. Do not ask for name, age, gender, city, or dating preference. Those are already collected.

# CLOSING AND DATA HANDOFF
After the user answers the bio prompt:
1. Create a concise, catchy dating bio based on what they said.
2. Say exactly: "Perfect. I've set up your profile and your bio looks great. You're all ready to go!"
3. Send a client-visible message containing PROFILE_DATA followed by minified JSON with this shape:
${JSON.stringify(profilePayload)}
4. End the call.`;
}

function buildBioAssistantOverrides(basics: BasicProfileForm): NonNullable<Parameters<Vapi["start"]>[1]> {
  return {
    firstMessage: buildBioFirstMessage(basics.name),
    firstMessageMode: "assistant-speaks-first",
    firstMessageInterruptionsEnabled: false,
    maxDurationSeconds: 240,
    endCallMessage: "You're all ready to go!",
    endCallPhrases: ["You're all ready to go"],
    variableValues: {
      name: basics.name,
      age: basics.age,
      genderIdentity: basics.genderIdentity,
      location: basics.location,
      lookingFor: basics.lookingFor,
    },
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 180,
      messages: [
        {
          role: "system",
          content: buildBioSystemPrompt(basics),
        },
      ],
    },
  };
}

function messageText(message: unknown): string {
  if (typeof message !== "object" || message === null) return "";
  const { text, transcript } = message as { text?: unknown; transcript?: unknown };
  if (typeof transcript === "string") return transcript;
  if (typeof text === "string") return text;
  return "";
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
  const [basicProfile, setBasicProfile] = useState<BasicProfileForm>(defaultBasicProfile);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Stable ref so processAndSaveProfile always sees latest profile state
  const profileRef = useRef<ProfileData>({});

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const currentStep = basicProfileSteps[currentStepIndex];
  const isLastBasicStep = currentStepIndex === basicProfileSteps.length - 1;
  const currentValue = basicProfile[currentStep.key];

  function updateBasicProfile<K extends keyof BasicProfileForm>(key: K, value: BasicProfileForm[K]) {
    setBasicProfile((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function validateCurrentStep(): string | null {
    const trimmedValue = String(currentValue).trim();
    if (!trimmedValue) return "Answer this question to continue.";

    if (currentStep.key === "age") {
      const age = Number(trimmedValue);
      if (!Number.isInteger(age) || age < 18 || age > 100) {
        return "Enter an age between 18 and 100.";
      }
    }

    return null;
  }

  function goToNextBasicStep() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setCurrentStepIndex((index) => Math.min(index + 1, basicProfileSteps.length - 1));
  }

  function goToPreviousBasicStep() {
    setError(null);
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  }

  const processAndSaveProfile = useCallback((data: ProfileData) => {
    if (isComplete) return;
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
  }, [isComplete, router]);

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
    if (!vapiAssistantId) {
      setError("Voice onboarding is not configured. NEXT_PUBLIC_VAPI_ASSISTANT_ID is missing.");
      return;
    }

    setError(null);

    // Auto-terminate after eight minutes so microphone access cannot remain open indefinitely.
    callTimeoutRef.current = setTimeout(() => { vapiRef.current?.stop(); }, 8 * 60 * 1000);

    try {
      await vapiRef.current.start(vapiAssistantId, buildBioAssistantOverrides(basicProfile));
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
          <div role="alert" className="alert-message rounded-2xl px-4 py-3 text-sm">
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
              className={`mt-1 h-5 w-5 rounded-full ${isCallActive ? "animate-pulse bg-[var(--interactive)] shadow-[0_0_26px_rgba(216,191,65,0.55)]" : "bg-white/18"}`}
            />
          </div>
          <p role="status" aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white">
            {isCallActive ? "Microphone active. The assistant can hear you now." : "Microphone inactive. Start the call when you are ready."}
          </p>
        </section>

        <section aria-labelledby="voice-flow-title" className="obsidian-card rounded-[30px] p-5">
          {!isCallActive && !isComplete && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/44">{currentStep.eyebrow}</p>
                <h2 id="voice-flow-title" className="text-2xl font-black tracking-tight text-white">{currentStep.title}</h2>
                <p className="text-sm leading-6 text-white/64">
                  {currentStep.help}
                </p>
              </div>

              <div className="apple-form-group">
                <div className="apple-form-row">
                  {currentStep.key === "name" ? (
                    <label className="grid gap-2">
                      <span className="apple-form-label">First name</span>
                      <input
                        className="field"
                        value={basicProfile.name}
                        onChange={(event) => updateBasicProfile("name", event.target.value)}
                        placeholder="Maya"
                        autoComplete="given-name"
                        autoFocus
                      />
                    </label>
                  ) : null}

                  {currentStep.key === "age" ? (
                    <label className="grid gap-2">
                      <span className="apple-form-label">Age</span>
                      <input
                        className="field"
                        value={basicProfile.age}
                        onChange={(event) => updateBasicProfile("age", event.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="28"
                        inputMode="numeric"
                        autoComplete="bday-year"
                        autoFocus
                      />
                    </label>
                  ) : null}

                  {currentStep.key === "genderIdentity" ? (
                    <div className="grid gap-3">
                      <label className="grid gap-2">
                        <span className="apple-form-label">Gender identity</span>
                        <input
                          className="field"
                          value={basicProfile.genderIdentity}
                          onChange={(event) => updateBasicProfile("genderIdentity", event.target.value)}
                          placeholder="Woman, man, non-binary..."
                          autoComplete="sex"
                          autoFocus
                        />
                      </label>
                      <div className="apple-choice-grid" aria-label="Common gender identity options">
                        {["Woman", "Man", "Non-binary"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            className="apple-choice"
                            data-selected={basicProfile.genderIdentity === option}
                            onClick={() => updateBasicProfile("genderIdentity", option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {currentStep.key === "location" ? (
                    <label className="grid gap-2">
                      <span className="apple-form-label">City</span>
                      <input
                        className="field"
                        value={basicProfile.location}
                        onChange={(event) => updateBasicProfile("location", event.target.value)}
                        placeholder="Brooklyn"
                        autoComplete="address-level2"
                        autoFocus
                      />
                    </label>
                  ) : null}

                  {currentStep.key === "lookingFor" ? (
                    <div className="grid gap-3">
                      <span className="apple-form-label">Dating preference</span>
                      <div className="apple-choice-grid" aria-label="Dating preference options">
                        {(["Men", "Women", "Everyone"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            className="apple-choice"
                            data-selected={basicProfile.lookingFor === option}
                            onClick={() => updateBasicProfile("lookingFor", option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={isLastBasicStep ? startVoiceOnboarding : goToNextBasicStep}
                className="primary-button w-full"
              >
                {isLastBasicStep ? "Start voice bio" : "Continue"}
              </button>

              {currentStepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goToPreviousBasicStep}
                  className="secondary-button w-full"
                >
                  Back
                </button>
              ) : null}

              <p className="text-center text-xs leading-5 text-white/50">
                Voice starts after these basics. It only asks for your bio.
              </p>
            </div>
          )}

          {isCallActive && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 id="voice-flow-title" className="text-xl font-black text-white">Call in progress</h2>
                <p className="text-sm leading-6 text-white/66">
                  Speak naturally. The assistant will only ask for a short bio.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <h3 className="text-sm font-black text-white">Visual equivalent of the audio prompt</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Last step: share what you like to do, your hobbies, or what you are looking for.
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
