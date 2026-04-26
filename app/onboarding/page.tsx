"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSection } from "@/components/OnboardingSection";
import { saveProfile, saveSignals, saveGap, syncProfileToServer, syncSignalsToServer, syncGapToServer } from "@/lib/storage";
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

const fieldClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

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
    // Sync to D1 — profileId may not be final yet, use a temp key derived from current name
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
      setError("Preference age range is invalid. Confirm min/max ages.");
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
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Clawnection Onboarding</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Build your romance profile</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            Your personal agent will represent your priorities during structured virtual dates. You stay in control of every real-world decision.
          </p>
          <p className="text-xs text-zinc-500">Preview: {profilePreview}</p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <OnboardingSection title="Core profile" description="Essentials used for introductions and baseline matching.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-zinc-700">Name *<input className={fieldClass} value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
              <label className="text-sm text-zinc-700">Age *<input className={fieldClass} value={form.age} onChange={(e) => update("age", e.target.value)} /></label>
              <label className="text-sm text-zinc-700">Gender identity<input className={fieldClass} value={form.genderIdentity} onChange={(e) => update("genderIdentity", e.target.value)} /></label>
              <label className="text-sm text-zinc-700">Looking for
                <select className={fieldClass} value={form.lookingFor} onChange={(e) => update("lookingFor", e.target.value as FormState["lookingFor"])}>
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Everyone">Everyone</option>
                </select>
              </label>
              <label className="text-sm text-zinc-700 sm:col-span-2">Location *<input className={fieldClass} value={form.location} onChange={(e) => update("location", e.target.value)} /></label>
            </div>
          </OnboardingSection>

          <OnboardingSection title="Connection preferences" description="What you want and how you relate.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-zinc-700">Relationship intent
                <select className={fieldClass} value={form.relationshipIntent} onChange={(e) => update("relationshipIntent", e.target.value as RelationshipIntent)}>
                  <option value="long-term">Long-term</option>
                  <option value="serious-dating">Serious dating</option>
                  <option value="exploring">Exploring</option>
                  <option value="friendship-first">Friendship first</option>
                </select>
              </label>
              <label className="text-sm text-zinc-700">Communication style
                <select className={fieldClass} value={form.communicationStyle} onChange={(e) => update("communicationStyle", e.target.value as CommunicationStyle)}>
                  <option value="balanced">Balanced</option>
                  <option value="direct">Direct</option>
                  <option value="warm">Warm</option>
                  <option value="playful">Playful</option>
                  <option value="reflective">Reflective</option>
                </select>
              </label>
              <label className="text-sm text-zinc-700 sm:col-span-2">Short bio *
                <textarea className={fieldClass} rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} />
              </label>
              <label className="text-sm text-zinc-700">Interests (comma-separated)
                <input className={fieldClass} value={form.interests} onChange={(e) => update("interests", e.target.value)} />
              </label>
              <label className="text-sm text-zinc-700">Values (comma-separated)
                <input className={fieldClass} value={form.values} onChange={(e) => update("values", e.target.value)} />
              </label>
            </div>
          </OnboardingSection>

          <OnboardingSection title="Lifestyle & boundaries" description="Signals that influence practical compatibility.">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["sleepSchedule", "Sleep schedule", ["early-bird", "flexible", "night-owl"]],
                ["socialEnergy", "Social energy", ["low-key", "balanced", "high-energy"]],
                ["activityLevel", "Activity level", ["relaxed", "active", "very-active"]],
                ["drinking", "Drinking", ["never", "social", "regular"]],
                ["smoking", "Smoking", ["never", "occasionally", "regular"]],
              ] as const).map(([key, label, options]) => (
                <label key={key} className="text-sm text-zinc-700">
                  {label}
                  <select
                    className={fieldClass}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value as FormState[typeof key])}
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="text-sm text-zinc-700 sm:col-span-2">Dealbreakers (comma-separated)
                <input className={fieldClass} value={form.dealbreakers} onChange={(e) => update("dealbreakers", e.target.value)} />
              </label>
              <label className="text-sm text-zinc-700 sm:col-span-2">Ideal first date
                <input className={fieldClass} value={form.idealFirstDate} onChange={(e) => update("idealFirstDate", e.target.value)} />
              </label>
            </div>
          </OnboardingSection>

          <OnboardingSection
            title={
              whatsAppApplied
                ? "Enrich with your WhatsApp data · Behavioral data applied ✓"
                : "Enrich with your WhatsApp data"
            }
            description="Optional. Upload one WhatsApp chat export — your data stays in your browser only."
          >
            <WhatsAppUpload
              currentProfile={buildCurrentProfile()}
              onApply={handleWhatsAppApply}
              onSkip={() => {}}
            />
          </OnboardingSection>

          <OnboardingSection title="Match preferences + agent mode" description="Set your counterpart preferences and choose your personal agent path.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-zinc-700">Preferred min age
                <input className={fieldClass} value={form.preferenceMinAge} onChange={(e) => update("preferenceMinAge", e.target.value)} />
              </label>
              <label className="text-sm text-zinc-700">Preferred max age
                <input className={fieldClass} value={form.preferenceMaxAge} onChange={(e) => update("preferenceMaxAge", e.target.value)} />
              </label>
              <label className="text-sm text-zinc-700 sm:col-span-2">Preference notes
                <textarea className={fieldClass} rows={2} value={form.preferenceNotes} onChange={(e) => update("preferenceNotes", e.target.value)} />
              </label>
              <fieldset className="sm:col-span-2 rounded-xl border border-zinc-200 p-3">
                <legend className="px-2 text-sm font-medium text-zinc-800">Agent type</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
                    <input type="radio" checked={form.agentType === "hosted"} onChange={() => update("agentType", "hosted")} /> Hosted Clawnection agent
                  </label>
                  <label className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
                    <input type="radio" checked={form.agentType === "external-mock"} onChange={() => update("agentType", "external-mock")} /> External/mock (BYO agent path)
                  </label>
                </div>
              </fieldset>
            </div>
          </OnboardingSection>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Save Profile & Continue to Demo
          </button>
        </form>
      </div>
    </main>
  );
}
