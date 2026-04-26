"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSection } from "@/components/OnboardingSection";
import { AppHeader } from "@/components/AppHeader";
import { PhoneShell } from "@/components/PhoneShell";
import {
  saveProfile,
  saveSignals,
  saveGap,
  syncProfileToServer,
  syncSignalsToServer,
  syncGapToServer,
} from "@/lib/storage";
import { CommunicationStyle, RelationshipIntent, RomanticProfile } from "@/lib/types/matching";
import { SelfAwarenessGap, WhatsAppSignals } from "@/lib/types/behavioral";
import { WhatsAppUpload } from "@/components/WhatsAppUpload";

type FormState = {
  name: string;
  age: string;
  genderIdentity: string;
  lookingFor: "Men" | "Women" | "Everyone";
  location: string;
  relationshipIntent: RelationshipIntent;
  bio: string;
  interests: string;
  values: string;
  communicationStyle: CommunicationStyle;
  sleepSchedule: RomanticProfile["lifestyleHabits"]["sleepSchedule"];
  socialEnergy: RomanticProfile["lifestyleHabits"]["socialEnergy"];
  activityLevel: RomanticProfile["lifestyleHabits"]["activityLevel"];
  drinking: RomanticProfile["lifestyleHabits"]["drinking"];
  smoking: RomanticProfile["lifestyleHabits"]["smoking"];
  dealbreakers: string;
  idealFirstDate: string;
  preferenceMinAge: string;
  preferenceMaxAge: string;
  preferenceNotes: string;
  agentType: RomanticProfile["agentType"];
};

const defaultForm: FormState = {
  name: "",
  age: "",
  genderIdentity: "",
  lookingFor: "Everyone",
  location: "",
  relationshipIntent: "long-term",
  bio: "",
  interests: "",
  values: "",
  communicationStyle: "balanced",
  sleepSchedule: "flexible",
  socialEnergy: "balanced",
  activityLevel: "active",
  drinking: "social",
  smoking: "never",
  dealbreakers: "",
  idealFirstDate: "",
  preferenceMinAge: "24",
  preferenceMaxAge: "38",
  preferenceNotes: "",
  agentType: "hosted",
};

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const fieldClass = "input-obsidian mt-1";
const textareaClass = `${fieldClass} min-h-[5rem] resize-y`;

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [whatsAppApplied, setWhatsAppApplied] = useState(false);

  const profilePreview = useMemo(() => `${form.name || "Your name"}, intent: ${form.relationshipIntent}`, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildCurrentProfile(): RomanticProfile {
    return {
      id: `local-${form.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: form.name || "You",
      age: Number(form.age) || 25,
      genderIdentity: form.genderIdentity,
      lookingFor: form.lookingFor,
      location: form.location,
      relationshipIntent: form.relationshipIntent,
      bio: form.bio,
      interests: parseCsv(form.interests),
      values: parseCsv(form.values),
      communicationStyle: form.communicationStyle,
      lifestyleHabits: {
        sleepSchedule: form.sleepSchedule,
        socialEnergy: form.socialEnergy,
        activityLevel: form.activityLevel,
        drinking: form.drinking,
        smoking: form.smoking,
      },
      dealbreakers: parseCsv(form.dealbreakers),
      idealFirstDate: form.idealFirstDate,
      preferenceAgeRange: { min: Number(form.preferenceMinAge) || 18, max: Number(form.preferenceMaxAge) || 60 },
      preferenceNotes: form.preferenceNotes,
      agentType: form.agentType,
    };
  }

  function handleWhatsAppApply(
    updatedProfile: RomanticProfile,
    signals: WhatsAppSignals,
    gap: SelfAwarenessGap,
  ) {
    update("communicationStyle", updatedProfile.communicationStyle);
    update("sleepSchedule", updatedProfile.lifestyleHabits.sleepSchedule);
    saveSignals(signals);
    saveGap(gap);
    const tempId = `local-${updatedProfile.name.toLowerCase().replace(/\s+/g, "-")}`;
    syncSignalsToServer(tempId, signals, signals.userMessageCount);
    syncGapToServer(tempId, gap);
    setWhatsAppApplied(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name || !form.age || !form.location || !form.bio) {
      setError("Please complete all required fields before continuing.");
      return;
    }

    const age = Number(form.age);
    const min = Number(form.preferenceMinAge);
    const max = Number(form.preferenceMaxAge);

    if (Number.isNaN(age) || age < 18 || age > 100) {
      setError("Please enter a valid age between 18 and 100.");
      return;
    }

    if (Number.isNaN(min) || Number.isNaN(max) || min < 18 || max < min) {
      setError("Preference age range is invalid. Confirm min and max ages.");
      return;
    }

    const profile: RomanticProfile = {
      id: `local-${form.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: form.name,
      age,
      genderIdentity: form.genderIdentity,
      lookingFor: form.lookingFor,
      location: form.location,
      relationshipIntent: form.relationshipIntent,
      bio: form.bio,
      interests: parseCsv(form.interests),
      values: parseCsv(form.values),
      communicationStyle: form.communicationStyle,
      lifestyleHabits: {
        sleepSchedule: form.sleepSchedule,
        socialEnergy: form.socialEnergy,
        activityLevel: form.activityLevel,
        drinking: form.drinking,
        smoking: form.smoking,
      },
      dealbreakers: parseCsv(form.dealbreakers),
      idealFirstDate: form.idealFirstDate,
      preferenceAgeRange: { min, max },
      preferenceNotes: form.preferenceNotes,
      agentType: form.agentType,
    };

    saveProfile(profile);
    syncProfileToServer(profile);
    router.push("/demo");
  }

  return (
    <PhoneShell label="Profile onboarding form">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-6 pb-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Text onboarding</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Build your romance profile</h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Your personal agent represents your priorities during structured virtual introductions. You approve every
            real-world decision.
          </p>
          <p className="text-xs text-[var(--text-muted)]">Live preview: {profilePreview}</p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <OnboardingSection title="Core profile" description="Basics used for introductions and baseline matching.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-[var(--text-secondary)]">
                Name (required)
                <input className={fieldClass} value={form.name} onChange={(e) => update("name", e.target.value)} required />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Age (required)
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Gender identity
                <input className={fieldClass} value={form.genderIdentity} onChange={(e) => update("genderIdentity", e.target.value)} />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Who you want to meet
                <select className={fieldClass} value={form.lookingFor} onChange={(e) => update("lookingFor", e.target.value as FormState["lookingFor"])}>
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Everyone">Everyone</option>
                </select>
              </label>
              <label className="block text-sm text-[var(--text-secondary)] sm:col-span-2">
                Location (required)
                <input className={fieldClass} value={form.location} onChange={(e) => update("location", e.target.value)} required />
              </label>
            </div>
          </OnboardingSection>

          <OnboardingSection title="Connection preferences" description="What you want and how you relate.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-[var(--text-secondary)]">
                Relationship intent
                <select
                  className={fieldClass}
                  value={form.relationshipIntent}
                  onChange={(e) => update("relationshipIntent", e.target.value as RelationshipIntent)}
                >
                  <option value="long-term">Long-term</option>
                  <option value="serious-dating">Serious dating</option>
                  <option value="exploring">Exploring</option>
                  <option value="friendship-first">Friendship first</option>
                </select>
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Communication style
                <select
                  className={fieldClass}
                  value={form.communicationStyle}
                  onChange={(e) => update("communicationStyle", e.target.value as CommunicationStyle)}
                >
                  <option value="balanced">Balanced</option>
                  <option value="direct">Direct</option>
                  <option value="warm">Warm</option>
                  <option value="playful">Playful</option>
                  <option value="reflective">Reflective</option>
                </select>
              </label>
              <label className="block text-sm text-[var(--text-secondary)] sm:col-span-2">
                Short bio (required)
                <textarea className={textareaClass} rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} required />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Interests (comma-separated)
                <input className={fieldClass} value={form.interests} onChange={(e) => update("interests", e.target.value)} />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Values (comma-separated)
                <input className={fieldClass} value={form.values} onChange={(e) => update("values", e.target.value)} />
              </label>
            </div>
          </OnboardingSection>

          <OnboardingSection title="Lifestyle and boundaries" description="Practical signals that affect day-to-day fit.">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["sleepSchedule", "Sleep schedule", ["early-bird", "flexible", "night-owl"]],
                  ["socialEnergy", "Social energy", ["low-key", "balanced", "high-energy"]],
                  ["activityLevel", "Activity level", ["relaxed", "active", "very-active"]],
                  ["drinking", "Drinking", ["never", "social", "regular"]],
                  ["smoking", "Smoking", ["never", "occasionally", "regular"]],
                ] as const
              ).map(([key, label, options]) => (
                <label key={key} className="block text-sm text-[var(--text-secondary)]">
                  {label}
                  <select className={fieldClass} value={form[key]} onChange={(e) => update(key, e.target.value as FormState[typeof key])}>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="block text-sm text-[var(--text-secondary)] sm:col-span-2">
                Dealbreakers (comma-separated)
                <input className={fieldClass} value={form.dealbreakers} onChange={(e) => update("dealbreakers", e.target.value)} />
              </label>
              <label className="block text-sm text-[var(--text-secondary)] sm:col-span-2">
                Ideal first date
                <input className={fieldClass} value={form.idealFirstDate} onChange={(e) => update("idealFirstDate", e.target.value)} />
              </label>
            </div>
          </OnboardingSection>

          <OnboardingSection
            title={
              whatsAppApplied
                ? "Optional WhatsApp enrichment · behavioral data applied"
                : "Optional WhatsApp enrichment"
            }
            description="Upload a WhatsApp export if you want. Parsing runs in your browser; use only chats you are allowed to analyze."
          >
            <WhatsAppUpload currentProfile={buildCurrentProfile()} onApply={handleWhatsAppApply} onSkip={() => {}} />
          </OnboardingSection>

          <OnboardingSection
            title="Match preferences and agent mode"
            description="Who you hope to meet and whether your agent is hosted here or external."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-[var(--text-secondary)]">
                Preferred minimum age
                <input className={fieldClass} value={form.preferenceMinAge} onChange={(e) => update("preferenceMinAge", e.target.value)} />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Preferred maximum age
                <input className={fieldClass} value={form.preferenceMaxAge} onChange={(e) => update("preferenceMaxAge", e.target.value)} />
              </label>
              <label className="block text-sm text-[var(--text-secondary)] sm:col-span-2">
                Preference notes
                <textarea className={textareaClass} rows={2} value={form.preferenceNotes} onChange={(e) => update("preferenceNotes", e.target.value)} />
              </label>
              <fieldset className="sm:col-span-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <legend className="px-1 text-sm font-medium text-[var(--text-primary)]">Agent type</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer gap-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)]">
                    <input type="radio" className="mt-1" checked={form.agentType === "hosted"} onChange={() => update("agentType", "hosted")} />
                    Hosted WTF Radar agent
                  </label>
                  <label className="flex cursor-pointer gap-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)]">
                    <input type="radio" className="mt-1" checked={form.agentType === "external-mock"} onChange={() => update("agentType", "external-mock")} />
                    External mock (bring your own agent path)
                  </label>
                </div>
              </fieldset>
            </div>
          </OnboardingSection>

          {error ? (
            <p className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full touch-target">
            Save profile and open sample match
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-secondary)]">
          Prefer voice?{" "}
          <Link href="/voice-onboarding" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
            Go to voice onboarding (microphone required)
          </Link>
          .
        </p>
      </div>
    </PhoneShell>
  );
}
