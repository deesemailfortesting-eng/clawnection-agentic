"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { AppHeader } from "@/components/AppHeader";
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

type TranscriptLine = { id: string; role: "assistant" | "user" | "system"; text: string };

function extractTranscriptText(message: Record<string, unknown>): string | null {
  if (typeof message.transcript === "string" && message.transcript.trim()) {
    return message.transcript.trim();
  }
  if (typeof message.text === "string" && message.text.trim() && !message.text.includes("PROFILE_DATA:")) {
    return message.text.trim();
  }
  const content = message.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((c) => {
        if (typeof c === "object" && c && "text" in c && typeof (c as { text?: string }).text === "string") {
          return (c as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" ").trim();
  }
  return null;
}

function roleFromMessage(message: Record<string, unknown>): TranscriptLine["role"] {
  const role = message.role;
  if (role === "user" || role === "assistant" || role === "system") return role;
  const type = message.type;
  if (type === "transcript" || type === "speech-update" || type === "conversation-update") {
    if (message.assistant === true || message.speaker === "assistant") return "assistant";
    if (message.user === true || message.speaker === "user") return "user";
  }
  return "assistant";
}

export default function VoiceOnboardingPage() {
  const router = useRouter();
  const vapiConfigError =
    typeof process.env.NEXT_PUBLIC_VAPI_API_KEY === "string" && process.env.NEXT_PUBLIC_VAPI_API_KEY.length > 0
      ? null
      : "Voice onboarding is not configured. NEXT_PUBLIC_VAPI_API_KEY is missing.";
  const vapiRef = useRef<Vapi | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const nameFieldId = useId();
  const genderFieldId = useId();
  const prefFieldId = useId();

  const [isCallActive, setIsCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preCallData, setPreCallData] = useState({
    name: "",
    gender: "",
    sexualPreference: "",
  });
  const [showPreCallForm, setShowPreCallForm] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [liveStatus, setLiveStatus] = useState("");

  const profileRef = useRef<ProfileData>({});

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const appendTranscript = useCallback((role: TranscriptLine["role"], text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && trimmed.length < 400 && last.text.endsWith(trimmed.slice(0, 12))) {
        return prev;
      }
      return [...prev, { id: crypto.randomUUID(), role, text: trimmed }];
    });
  }, []);

  const processAndSaveProfile = useCallback(
    (data: ProfileData) => {
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
      syncProfileToServer(romanticProfile);
      setIsComplete(true);
      setTimeout(() => router.push("/review-profile?from=voice"), 2000);
    },
    [router],
  );

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    if (!apiKey) {
      return;
    }

    vapiRef.current = new Vapi(apiKey);
    const vapi = vapiRef.current;

    vapi.on("call-start", () => {
      setIsCallActive(true);
      const muted = vapi.isMuted();
      setMicMuted(muted);
      setLiveStatus(
        muted
          ? "Call connected. Your microphone is muted; unmute when you want to speak."
          : "Call connected. Your microphone is active unless you mute it.",
      );
      appendTranscript("system", "Call connected. The assistant speaks aloud; captions appear below as text arrives.");
    });

    vapi.on("call-end", () => {
      setIsCallActive(false);
      setAssistantSpeaking(false);
      setLiveStatus("Call ended.");
      appendTranscript("system", "Call ended.");
      processAndSaveProfile(profileRef.current);
    });

    vapi.on("message", (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const m = message as Record<string, unknown>;
      const textField = typeof m.text === "string" ? m.text : "";
      const jsonMatch = textField.match(/PROFILE_DATA:\s*(\{.*\})/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]!) as ProfileData;
          setProfile(data);
          profileRef.current = data;
        } catch {
          /* malformed JSON */
        }
        return;
      }

      const line = extractTranscriptText(m);
      if (line) {
        appendTranscript(roleFromMessage(m), line);
      }
    });

    vapi.on("speech-start", () => {
      setAssistantSpeaking(true);
      setLiveStatus("Assistant audio is playing. Text equivalents appear in the transcript when available.");
    });

    vapi.on("speech-end", () => {
      setAssistantSpeaking(false);
      setLiveStatus("You can speak when ready. The microphone stays on unless you mute it.");
    });

    vapi.on("error", () => {
      setIsCallActive(false);
      setAssistantSpeaking(false);
    });

    return () => {
      void vapi.stop();
    };
  }, [appendTranscript, processAndSaveProfile]);

  async function startVoiceOnboarding() {
    if (vapiConfigError) {
      setError(vapiConfigError);
      return;
    }
    if (!vapiRef.current) {
      setError("Voice client is not ready. Check NEXT_PUBLIC_VAPI_API_KEY.");
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
    setTranscript([]);
    setMicMuted(false);

    setTimeout(() => {
      vapiRef.current?.stop();
    }, 30 * 60 * 1000);

    const firstMessage = `Hey ${preCallData.name} — WTF Radar here. I can see from what you shared that you identify as ${preCallData.gender} and your dating preference is ${preCallData.sexualPreference}. Before we get going, just so you know what this is: we're gonna talk for however long feels right. After this, I spin up a version of you that goes and chats with other people's agents — and when yours genuinely clicks with someone, we set up a real meet. So this is just… you and me, for a bit. No form, no right answers. Where are you right now — like, physically, what room are you in?`;

    try {
      appendTranscript("assistant", firstMessage);
      await vapiRef.current.start(assistantId, { firstMessage });
      setShowPreCallForm(false);
    } catch {
      setError("Failed to start the call. Check your Vapi credentials and microphone permission.");
    }
  }

  function toggleMute() {
    const vapi = vapiRef.current;
    if (!vapi || !isCallActive) return;
    const currentlyMuted = vapi.isMuted();
    const nextMuted = !currentlyMuted;
    vapi.setMuted(nextMuted);
    setMicMuted(nextMuted);
    setLiveStatus(
      nextMuted
        ? "Microphone muted. Unmute when you want the assistant to hear you."
        : "Microphone active. The assistant can hear you.",
    );
    appendTranscript("system", nextMuted ? "You muted your microphone." : "You unmuted your microphone.");
  }

  return (
    <PhoneShell label="Voice profile onboarding">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-6 pb-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Voice onboarding</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Build your profile by voice</h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            You will use your device microphone. The assistant replies with audio; we show on-screen text whenever the
            platform sends captions or messages so you are not relying on sound alone.
          </p>
        </header>

        {vapiConfigError || error ? (
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]" role="alert">
            {vapiConfigError ?? error}
          </div>
        ) : null}

        <section className="card-obsidian" aria-labelledby="voice-session-heading">
          <h2 id="voice-session-heading" className="text-base font-semibold text-[var(--text-primary)]">
            Voice session
          </h2>

          <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                isCallActive
                  ? micMuted
                    ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40"
                    : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
                  : "bg-[var(--surface-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border-subtle)]"
              }`}
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                {isCallActive && !micMuted ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                ) : null}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isCallActive ? (micMuted ? "bg-amber-400" : "bg-emerald-400") : "bg-zinc-500"
                  }`}
                />
              </span>
              {isCallActive ? (micMuted ? "Microphone muted" : "Microphone active") : "Microphone off (no active call)"}
            </span>
            {isCallActive ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                  assistantSpeaking
                    ? "bg-[var(--accent-soft)] text-[var(--text-primary)] ring-[var(--accent)]/50"
                    : "bg-[var(--surface-elevated)] text-[var(--text-muted)] ring-[var(--border-subtle)]"
                }`}
              >
                {assistantSpeaking ? "Assistant audio playing" : "Assistant audio idle"}
              </span>
            ) : null}
          </div>

          <p className="sr-only" aria-live="assertive">
            {liveStatus}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]" aria-hidden="true">
            {liveStatus}
          </p>

          {showPreCallForm && !isCallActive && !isComplete ? (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Before the call</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  This helps the assistant personalize the conversation. You will be asked to allow microphone access.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block text-sm text-[var(--text-secondary)]" htmlFor={nameFieldId}>
                  What is your name?
                  <input
                    id={nameFieldId}
                    type="text"
                    className="input-obsidian mt-1"
                    value={preCallData.name}
                    onChange={(e) => setPreCallData((p) => ({ ...p, name: e.target.value }))}
                    autoComplete="name"
                    placeholder="Your first name"
                  />
                </label>

                <label className="block text-sm text-[var(--text-secondary)]" htmlFor={genderFieldId}>
                  How do you describe your gender?
                  <select
                    id={genderFieldId}
                    className="input-obsidian mt-1"
                    value={preCallData.gender}
                    onChange={(e) => setPreCallData((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="">Select an option</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Another identity</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </label>

                <label className="block text-sm text-[var(--text-secondary)]" htmlFor={prefFieldId}>
                  Who are you interested in meeting? (dating orientation)
                  <select
                    id={prefFieldId}
                    className="input-obsidian mt-1"
                    value={preCallData.sexualPreference}
                    onChange={(e) => setPreCallData((p) => ({ ...p, sexualPreference: e.target.value }))}
                  >
                    <option value="">Select an option</option>
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
                onClick={() => void startVoiceOnboarding()}
                disabled={!!vapiConfigError || !preCallData.name || !preCallData.gender || !preCallData.sexualPreference}
                className="btn-primary w-full touch-target disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start voice session (enables microphone)
              </button>

              <p className="text-center text-xs text-[var(--text-muted)]">
                The session ends automatically after 30 minutes. You can end it early at any time.
              </p>
            </div>
          ) : null}

          {isCallActive ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                  Speak naturally. Use mute if you need privacy; unmute when you are ready to respond.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="btn-secondary touch-target min-w-[44px] flex-1 sm:flex-none"
                    aria-pressed={micMuted}
                  >
                    {micMuted ? "Unmute microphone" : "Mute microphone"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void vapiRef.current?.stop()}
                    className="btn-secondary touch-target min-w-[44px] flex-1 border-red-500/40 text-red-200 sm:flex-none"
                  >
                    End voice session
                  </button>
                </div>
              </div>

              <div
                className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3"
                role="log"
                aria-relevant="additions"
                aria-label="Conversation transcript"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">On-screen transcript</h3>
                <ul className="mt-2 space-y-2">
                  {transcript.length === 0 ? (
                    <li className="text-sm text-[var(--text-muted)]">
                      Waiting for captions from the assistant. If nothing appears, you can still follow the spoken prompts;
                      contact support for reasonable accommodations if you need a fully captioned flow.
                    </li>
                  ) : (
                    transcript.map((line) => (
                      <li key={line.id} className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {line.role === "assistant" ? "Assistant" : line.role === "user" ? "You" : "System"}
                          :{" "}
                        </span>
                        {line.text}
                      </li>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </ul>
              </div>
            </div>
          ) : null}

          {isComplete ? (
            <div className="mt-6 space-y-2 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">Profile saved</p>
              <p className="text-sm text-[var(--text-secondary)]">Opening the sample match screen…</p>
            </div>
          ) : null}
        </section>

        <p className="text-center text-sm text-[var(--text-secondary)]">
          Prefer the form?{" "}
          <Link href="/review-profile" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
            Open text-based profile onboarding
          </Link>
          .
        </p>
      </div>
    </PhoneShell>
  );
}
