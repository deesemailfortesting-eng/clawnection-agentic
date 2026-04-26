"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { saveProfile } from "@/lib/storage";
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
  const profileRef = useRef<ProfileData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [preCallData, setPreCallData] = useState({
    name: "",
    gender: "",
    sexualPreference: ""
  });
  const [showPreCallForm, setShowPreCallForm] = useState(true);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    if (!apiKey) {
      console.error("VAPI_API_KEY not found. Please set NEXT_PUBLIC_VAPI_API_KEY in your environment variables.");
      return;
    }

    vapiRef.current = new Vapi(apiKey);
    const vapi = vapiRef.current;

    vapi.on("call-start", () => {
      setIsCallActive(true);
    });

    vapi.on("call-end", () => {
      setIsCallActive(false);
      processAndSaveProfile();
    });

    vapi.on("message", (message: any) => {
      extractProfileData(message);
    });

    vapi.on("error", (error: any) => {
      console.error("Vapi error:", JSON.stringify(error, null, 2));
      setIsCallActive(false);
    });

    return () => {
      vapi.stop();
    };
  }, []);

  const extractProfileData = (message: any) => {
    // VAPI transcript events use message.transcript, not message.text
    const text = message.transcript || message.text || "";
    const jsonMatch = text.match(/PROFILE_DATA:\s*(\{.*\})/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        profileRef.current = data;
        setProfile(data);
      } catch (error) {
        console.error("Failed to parse profile data:", error);
      }
    }
  };

  const processAndSaveProfile = () => {
    // Read from ref to avoid stale closure over profile state
    const p = profileRef.current;
    if (p.name && p.age && p.location && p.bio) {
      const romanticProfile: RomanticProfile = {
        id: `voice-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: p.name,
        age: p.age,
        genderIdentity: p.genderIdentity || "",
        lookingFor: p.lookingFor || "",
        location: p.location,
        relationshipIntent: p.relationshipIntent || "long-term",
        bio: p.bio,
        interests: p.interests || [],
        values: p.values || [],
        communicationStyle: p.communicationStyle || "balanced",
        lifestyleHabits: {
          sleepSchedule: p.sleepSchedule || "flexible",
          socialEnergy: p.socialEnergy || "balanced",
          activityLevel: p.activityLevel || "active",
          drinking: p.drinking || "social",
          smoking: p.smoking || "never",
        },
        dealbreakers: p.dealbreakers || [],
        idealFirstDate: p.idealFirstDate || "",
        preferenceAgeRange: {
          min: p.preferenceMinAge || 24,
          max: p.preferenceMaxAge || 38,
        },
        preferenceNotes: p.preferenceNotes || "",
        agentType: p.agentType || "hosted",
      };

      saveProfile(romanticProfile);
      setIsComplete(true);
      setTimeout(() => router.push("/demo"), 2000);
    }
  };

  const startVoiceOnboarding = async () => {
    if (!vapiRef.current) {
      console.error("Vapi not initialized");
      return;
    }

    // Validate pre-call data
    if (!preCallData.name || !preCallData.gender || !preCallData.sexualPreference) {
      alert("Please fill in all fields before starting the call.");
      return;
    }

    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!assistantId) {
      console.error("VAPI_ASSISTANT_ID not found. Please set NEXT_PUBLIC_VAPI_ASSISTANT_ID in your environment variables.");
      return;
    }

    console.log("Starting voice onboarding with assistant:", assistantId);

    // Set up call timeout (30 minutes)
    const callTimeout = setTimeout(() => {
      if (vapiRef.current) {
        console.log("Call timeout reached (30 minutes), ending call");
        vapiRef.current.stop();
      }
    }, 30 * 60 * 1000); // 30 minutes in milliseconds

    try {
      const customFirstMessage = `Hey ${preCallData.name} — Clawnection here. I can see from what you shared that you identify as ${preCallData.gender} and your sexual preference is ${preCallData.sexualPreference}. Before we get going, just so you know what this is: we're gonna talk for however long feels right. After this, I spin up a version of you that goes and chats with other people's agents — and when yours genuinely clicks with someone, we set up a real meet. So this is just… you and me, for a bit. No form, no right answers. Where are you right now — like, physically, what room are you in?`;

      await vapiRef.current.start(assistantId, {
        firstMessage: customFirstMessage,
        variableValues: {
          name: preCallData.name,
          gender: preCallData.gender,
          sexualPreference: preCallData.sexualPreference,
        },
      });
      console.log("Vapi start successful");
      setShowPreCallForm(false);
    } catch (error) {
      console.error("Failed to start voice onboarding:", error);
      clearTimeout(callTimeout);
    }
  };

  const stopCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Voice Onboarding</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Build your romance profile with voice</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            Chat with our AI assistant to create your profile. Just speak naturally - we'll guide you through everything.
          </p>
        </header>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          {showPreCallForm ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-zinc-900 mb-2">Before we start chatting...</h2>
                <p className="text-sm text-zinc-600">Let's get to know you a bit first. This helps our AI assistant have a more personalized conversation.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">What's your name?</span>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    value={preCallData.name}
                    onChange={(e) => setPreCallData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">What's your gender?</span>
                  <select
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    value={preCallData.gender}
                    onChange={(e) => setPreCallData(prev => ({ ...prev, gender: e.target.value }))}
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
                    onChange={(e) => setPreCallData(prev => ({ ...prev, sexualPreference: e.target.value }))}
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
                className="w-full rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:bg-zinc-300 disabled:cursor-not-allowed"
              >
                Start 30-Minute Voice Chat
              </button>

              <p className="text-xs text-zinc-500 text-center">
                This call will automatically end after 30 minutes. You can end it early at any time.
              </p>
            </div>
          ) : !isCallActive && !isComplete ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-zinc-600">
                Ready to get started? Click the button below to begin your voice onboarding session.
              </p>
              <button
                onClick={startVoiceOnboarding}
                className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                Start Voice Onboarding
              </button>
            </div>
          ) : null}

          {isCallActive && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center space-x-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-green-500"></div>
                <p className="text-sm font-medium text-zinc-900">Call in progress</p>
              </div>
              <p className="text-sm text-zinc-600">
                Speak naturally with our assistant. We'll collect your profile information through conversation.
              </p>
              <button
                onClick={stopCall}
                className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-300"
              >
                End Call
              </button>
            </div>
          )}

          {isComplete && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <p className="text-sm font-medium text-zinc-900">Profile created successfully!</p>
              </div>
              <p className="text-sm text-zinc-600">
                Redirecting you to the demo in a moment...
              </p>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-zinc-500">
            Prefer to fill out the form manually?{" "}
            <a href="/onboarding" className="text-rose-500 hover:text-rose-600">
              Go to text onboarding
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}