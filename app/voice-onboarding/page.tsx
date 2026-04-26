"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { PhoneShell } from "@/components/PhoneShell";
import { VoiceOrb } from "@/components/VoiceOrb";
import { saveProfile, syncProfileToServer } from "@/lib/storage";
import {
  CommunicationStyle,
  Occupation,
  RelationshipIntent,
  RomanticProfile,
} from "@/lib/types/matching";

type ProfileData = {
  name?: string;
  lastName?: string;
  age?: number;
  phoneNumber?: string;
  genderIdentity?: string;
  lookingFor?: string;
  location?: string;
  occupation?: Occupation;
  instagram?: string;
  linkedin?: string;
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

type StepId =
  | "welcome"
  | "name"
  | "dob"
  | "phone"
  | "location"
  | "occupationType"
  | "occupationPlace"
  | "gender"
  | "preference"
  | "intent"
  | "socials"
  | "voice";

const STEP_ORDER: StepId[] = [
  "welcome",
  "name",
  "dob",
  "phone",
  "location",
  "occupationType",
  "occupationPlace",
  "gender",
  "preference",
  "intent",
  "socials",
  "voice",
];

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

/*
 * Capitalize each name token. Splits on spaces, hyphens, and apostrophes so
 * "mary jane" → "Mary Jane", "o'brien" → "O'Brien", "jean-luc" → "Jean-Luc".
 * Preserves all delimiters and lowercases everything after the first letter
 * of each token. Safe to call from onChange (idempotent).
 */
function capitalizeName(input: string): string {
  return input.replace(/([^\s'-]+)/g, (token) =>
    token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(),
  );
}

function computeAgeFromDob(year: number, month: number, day: number): number {
  if (!year || !month || !day) return 0;
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthdayThisYear =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

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

const intentOptions: ReadonlyArray<{
  value: RelationshipIntent;
  label: string;
  blurb: string;
}> = [
  { value: "long-term", label: "Long-term", blurb: "Looking for something serious." },
  { value: "serious-dating", label: "Serious dating", blurb: "Open to a real relationship." },
  { value: "exploring", label: "Exploring", blurb: "Seeing what feels right." },
  { value: "casual", label: "Casual / hookups", blurb: "Short-term, no pressure." },
  { value: "friendship-first", label: "Friends first", blurb: "Connection over romance." },
];

const occupationTypeOptions = [
  { value: "work" as const, label: "I work", blurb: "Tell us where" },
  { value: "school" as const, label: "I'm in school", blurb: "Where do you study?" },
];

const vapiApiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const vapiAssistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

function messageText(message: unknown): string {
  if (typeof message !== "object" || message === null || !("text" in message)) return "";
  const text = (message as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

// Light, format-friendly phone normalization. We don't validate carrier-correctness.
function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, "");
}

function formatPhoneDisplay(input: string): string {
  // Allows the user to see digit grouping while typing US-shaped numbers; non-US users keep raw +/digits.
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
}

export default function VoiceOnboardingPage() {
  const router = useRouter();
  const vapiRef = useRef<Vapi | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<ProfileData>({});
  const pendingProfileIdRef = useRef<string | null>(null);

  const [step, setStep] = useState<StepId>("welcome");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dobMonth, setDobMonth] = useState<number | "">("");
  const [dobDay, setDobDay] = useState<number | "">("");
  const [dobYear, setDobYear] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [occupationType, setOccupationType] = useState<"work" | "school" | "">("");
  const [occupationPlace, setOccupationPlace] = useState("");
  const [gender, setGender] = useState("");
  const [preference, setPreference] = useState("");
  const [intent, setIntent] = useState<RelationshipIntent | "">("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");

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

  const dobIsComplete =
    typeof dobMonth === "number" && typeof dobDay === "number" && typeof dobYear === "number";
  const ageNumber = dobIsComplete
    ? computeAgeFromDob(dobYear as number, dobMonth as number, dobDay as number)
    : 0;
  const ageIsValid = ageNumber >= 18 && ageNumber <= 120;
  const phoneDigitsOnly = phone.replace(/\D/g, "");
  const phoneIsValid = phoneDigitsOnly.length >= 7 && phoneDigitsOnly.length <= 15;
  const currentYear = new Date().getFullYear();
  const dobYearMax = currentYear - 18;
  const dobYearMin = currentYear - 100;
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = dobYearMax; y >= dobYearMin; y -= 1) years.push(y);
    return years;
  }, [dobYearMax, dobYearMin]);
  const dayOptionsCount =
    typeof dobMonth === "number" && typeof dobYear === "number"
      ? daysInMonth(dobMonth, dobYear)
      : 31;

  const processAndSaveProfile = useCallback(
    (data: ProfileData) => {
      const resolvedFirstName = data.name || firstName;
      const resolvedAge = data.age || ageNumber || 0;
      const resolvedLocation = data.location || location;
      const resolvedBio = data.bio || "";

      if (!resolvedFirstName || !resolvedAge || !resolvedLocation || !resolvedBio) return;

      const occupation: Occupation | undefined =
        data.occupation
          ? data.occupation
          : occupationType
            ? { type: occupationType, place: occupationPlace }
            : undefined;

      const romanticProfile: RomanticProfile = {
        id: pendingProfileIdRef.current ?? `voice-${crypto.randomUUID()}`,
        name: resolvedFirstName,
        lastName: data.lastName || lastName || undefined,
        age: resolvedAge,
        phoneNumber: data.phoneNumber || (phone ? normalizePhone(phone) : undefined),
        genderIdentity: data.genderIdentity || gender,
        lookingFor: data.lookingFor || "",
        location: resolvedLocation,
        occupation,
        instagram: data.instagram || instagram || undefined,
        linkedin: data.linkedin || linkedin || undefined,
        relationshipIntent: (data.relationshipIntent || intent || "long-term") as RelationshipIntent,
        bio: resolvedBio,
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
    },
    [
      ageNumber,
      firstName,
      gender,
      instagram,
      intent,
      lastName,
      linkedin,
      location,
      occupationPlace,
      occupationType,
      phone,
      router,
    ],
  );

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

    // Branch: skip the "where" follow-up if the user picks "neither/skip" later — for now we always ask.
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
      // Pre-generate and persist the profileId so the webhook FK resolves when it arrives.
      const profileId = `voice-${crypto.randomUUID()}`;
      pendingProfileIdRef.current = profileId;
      const stubProfile: RomanticProfile = {
        id: profileId,
        name: firstName,
        lastName: lastName || undefined,
        age: ageNumber,
        phoneNumber: phone ? normalizePhone(phone) : undefined,
        genderIdentity: gender,
        lookingFor: preference,
        location,
        occupation: occupationType ? { type: occupationType, place: occupationPlace } : undefined,
        relationshipIntent: (intent || "long-term") as RelationshipIntent,
        bio: "",
        interests: [],
        values: [],
        communicationStyle: "balanced",
        lifestyleHabits: { sleepSchedule: "flexible", socialEnergy: "balanced", activityLevel: "active", drinking: "social", smoking: "never" },
        dealbreakers: [],
        idealFirstDate: "",
        preferenceAgeRange: { min: 24, max: 38 },
        preferenceNotes: "",
        agentType: "hosted",
      };
      saveProfile(stubProfile);
      syncProfileToServer(stubProfile);

      const occupationDetail =
        occupationType === "work"
          ? `they work${occupationPlace ? ` at ${occupationPlace}` : ""}`
          : occupationType === "school"
            ? `they study${occupationPlace ? ` at ${occupationPlace}` : ""}`
            : "";
      const intentLabel = intentOptions.find((o) => o.value === intent)?.label.toLowerCase() ?? "long-term";
      const firstMessage = `Hey ${firstName}. This is wtfradar. You said you're ${ageNumber}, based in ${location}${occupationDetail ? `, and ${occupationDetail}` : ""}. You identify as ${gender}, you're interested in ${preference}, and you're here for ${intentLabel}. We'll have a guided conversation to round out your dating profile. There are no right answers. To begin — what does an amazing first date look like for you?`;
      await vapiRef.current.start(vapiAssistantId, {
        firstMessage,
        variableValues: {
          profileId,
          name: firstName,
          gender,
          sexual_preference: preference,
        },
      });
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
    (step === "name" && (!firstName.trim() || !lastName.trim())) ||
    (step === "dob" && !ageIsValid) ||
    (step === "phone" && !phoneIsValid) ||
    (step === "location" && !location.trim()) ||
    (step === "occupationType" && !occupationType) ||
    (step === "occupationPlace" && !occupationPlace.trim()) ||
    (step === "gender" && !gender) ||
    (step === "preference" && !preference) ||
    (step === "intent" && !intent);

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
          <StepLayout
            pill="A bit about you"
            title="What's your name?"
            description="Last names stay private until you and a match both agree to share."
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
            <label className="grid gap-1 text-sm font-bold text-white/84">
              <span className="text-xs uppercase tracking-[0.18em] text-white/52">First name</span>
              <input
                className="field text-lg"
                value={firstName}
                onChange={(event) => setFirstName(capitalizeName(event.target.value))}
                placeholder="First name"
                autoFocus
                autoComplete="given-name"
                autoCapitalize="words"
                spellCheck={false}
                aria-label="First name"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-white/84">
              <span className="text-xs uppercase tracking-[0.18em] text-white/52">Last name</span>
              <input
                className="field text-lg"
                value={lastName}
                onChange={(event) => setLastName(capitalizeName(event.target.value))}
                placeholder="Last name"
                autoComplete="family-name"
                autoCapitalize="words"
                spellCheck={false}
                aria-label="Last name"
              />
            </label>
          </StepLayout>
        )}

        {step === "dob" && (
          <StepLayout
            pill="A bit about you"
            title="When's your birthday?"
            description="You must be 18 or older to use wtfradar. We only show your age, not your full birthday."
            onContinue={goNext}
            continueDisabled={continueDisabled}
            error={dobIsComplete && !ageIsValid ? "You must be 18 or older to continue." : undefined}
          >
            <div className="grid grid-cols-[1.4fr_0.9fr_1.1fr] gap-2">
              <label className="grid gap-1 text-sm font-bold text-white/84">
                <span className="text-xs uppercase tracking-[0.18em] text-white/52">Month</span>
                <select
                  className="field"
                  value={dobMonth === "" ? "" : String(dobMonth)}
                  onChange={(event) =>
                    setDobMonth(event.target.value ? Number(event.target.value) : "")
                  }
                  aria-label="Birth month"
                >
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((label, idx) => (
                    <option key={label} value={idx + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-white/84">
                <span className="text-xs uppercase tracking-[0.18em] text-white/52">Day</span>
                <select
                  className="field"
                  value={dobDay === "" ? "" : String(dobDay)}
                  onChange={(event) =>
                    setDobDay(event.target.value ? Number(event.target.value) : "")
                  }
                  aria-label="Birth day"
                >
                  <option value="">Day</option>
                  {Array.from({ length: dayOptionsCount }, (_, idx) => idx + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-white/84">
                <span className="text-xs uppercase tracking-[0.18em] text-white/52">Year</span>
                <select
                  className="field"
                  value={dobYear === "" ? "" : String(dobYear)}
                  onChange={(event) =>
                    setDobYear(event.target.value ? Number(event.target.value) : "")
                  }
                  aria-label="Birth year"
                >
                  <option value="">Year</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {ageIsValid ? (
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/52">
                You&apos;ll be shown as {ageNumber}
              </p>
            ) : null}
          </StepLayout>
        )}

        {step === "phone" && (
          <StepLayout
            pill="Account"
            title="What's your phone number?"
            description="We use it for verification and account recovery — never shared with matches."
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
            <input
              className="field text-lg"
              value={phone}
              onChange={(event) => setPhone(formatPhoneDisplay(event.target.value))}
              placeholder="(555) 555-1234"
              type="tel"
              inputMode="tel"
              autoFocus
              autoComplete="tel"
              aria-label="Phone number"
            />
          </StepLayout>
        )}

        {step === "location" && (
          <StepLayout
            pill="Where you are"
            title="Where do you live?"
            description="City and state, or city and country. We use it to find nearby matches."
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
            <input
              className="field text-lg"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Cambridge, MA"
              autoFocus
              autoComplete="address-level2"
              aria-label="Location"
            />
          </StepLayout>
        )}

        {step === "occupationType" && (
          <StepLayout
            pill="What you're up to"
            title="What's your day job?"
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
            <div className="grid gap-3">
              {occupationTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="option-tile"
                  data-selected={occupationType === option.value}
                  onClick={() => setOccupationType(option.value)}
                >
                  <span>
                    <span className="block text-base font-bold text-white">{option.label}</span>
                    <span className="block text-xs text-white/56">{option.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </StepLayout>
        )}

        {step === "occupationPlace" && (
          <StepLayout
            pill="What you're up to"
            title={
              occupationType === "school" ? "Where do you study?" : "Where do you work?"
            }
            description={
              occupationType === "school"
                ? "School or university name."
                : "Company or what you do — your call."
            }
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
            <input
              className="field text-lg"
              value={occupationPlace}
              onChange={(event) => setOccupationPlace(event.target.value)}
              placeholder={occupationType === "school" ? "e.g. MIT" : "e.g. Anthropic"}
              autoFocus
              autoComplete="organization"
              aria-label={occupationType === "school" ? "School name" : "Work place"}
            />
          </StepLayout>
        )}

        {step === "gender" && (
          <StepLayout
            pill="About you"
            title="I am a..."
            description="Pick the option that fits best — you can be more specific in the voice chat."
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
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
          </StepLayout>
        )}

        {step === "preference" && (
          <StepLayout
            pill="Who you're looking for"
            title="I'm attracted to..."
            description="This helps your agent line up the right virtual dates."
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
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
          </StepLayout>
        )}

        {step === "intent" && (
          <StepLayout
            pill="What you want"
            title="What kind of relationship?"
            description="Be honest — your agent will only match you with people who want similar things."
            onContinue={goNext}
            continueDisabled={continueDisabled}
          >
            <div className="grid gap-3">
              {intentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="option-tile"
                  data-selected={intent === option.value}
                  onClick={() => setIntent(option.value)}
                >
                  <span>
                    <span className="block text-base font-bold text-white">{option.label}</span>
                    <span className="block text-xs text-white/56">{option.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </StepLayout>
        )}

        {step === "socials" && (
          <StepLayout
            pill="Optional"
            title="Add your socials?"
            description="Totally optional — you can add or remove these any time. Only shared after you both opt in."
            onContinue={goNext}
            continueDisabled={false}
            continueLabel={instagram || linkedin ? "Continue" : "Skip for now"}
          >
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm font-bold text-white/84">
                <span className="text-xs uppercase tracking-[0.18em] text-white/52">Instagram</span>
                <input
                  className="field"
                  value={instagram}
                  onChange={(event) => setInstagram(event.target.value.replace(/^@/, ""))}
                  placeholder="@yourhandle"
                  autoComplete="off"
                  aria-label="Instagram handle"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-white/84">
                <span className="text-xs uppercase tracking-[0.18em] text-white/52">LinkedIn</span>
                <input
                  className="field"
                  value={linkedin}
                  onChange={(event) => setLinkedin(event.target.value)}
                  placeholder="linkedin.com/in/you"
                  autoComplete="off"
                  aria-label="LinkedIn URL or handle"
                />
              </label>
            </div>
          </StepLayout>
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
                    : `Ready, ${firstName || "friend"}?`}
              </h1>
              <p className="mx-auto max-w-[28ch] text-sm leading-6 text-white/66">
                {isComplete
                  ? "Heading to your virtual date demo…"
                  : isCallActive
                    ? "Your agent is listening. Tell it about your life, what you want, and what you avoid."
                    : "Tap the orb to start a short voice intro. End anytime."}
              </p>
            </div>

            <VoiceOrb
              active={isCallActive}
              disabled={isComplete}
              onClick={isCallActive ? endVoiceCall : startVoiceCall}
              ariaLabel={isCallActive ? "End voice call" : "Start voice call"}
            />

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

function StepLayout({
  pill,
  title,
  description,
  children,
  onContinue,
  continueDisabled,
  continueLabel = "Continue",
  error,
}: {
  pill: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueDisabled: boolean;
  continueLabel?: string;
  error?: string;
}) {
  return (
    <section className="flex flex-1 flex-col justify-between gap-8">
      <div className="space-y-5">
        <p className="pill w-fit">{pill}</p>
        <h1 className="text-4xl font-black leading-[1] tracking-[-0.04em] text-white">{title}</h1>
        {description ? <p className="text-sm leading-6 text-white/62">{description}</p> : null}
        <div className="space-y-3">{children}</div>
        {error ? (
          <p role="alert" className="rounded-2xl border border-red-300/40 bg-red-500/12 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={continueDisabled}
        className="primary-button w-full"
      >
        {continueLabel}
      </button>
    </section>
  );
}
