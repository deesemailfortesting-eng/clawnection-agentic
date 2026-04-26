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
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Initialize Vapi
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    if (!apiKey) {
      console.error("VAPI_API_KEY not found. Please set NEXT_PUBLIC_VAPI_API_KEY in your environment variables.");
      return;
    }

    console.log("Initializing Vapi with API key:", apiKey.substring(0, 10) + "...");

    console.log("Initializing Vapi with API key:", apiKey.substring(0, 10) + "...");

    // Try setting API key globally if the SDK supports it
    if (typeof window !== 'undefined' && (window as any).Vapi) {
      (window as any).Vapi.apiKey = apiKey;
    }

    vapiRef.current = new Vapi({
      onError: (error) => {
        console.error("Vapi initialization error:", error);
      }
    });

    console.log("Vapi initialized successfully:", !!vapiRef.current);

    // Set up event listeners
    const vapi = vapiRef.current;

    vapi.on("call-start", () => {
      console.log("Call started");
      setIsCallActive(true);
    });

    vapi.on("call-end", () => {
      console.log("Call ended");
      setIsCallActive(false);
      // Process the collected data and save profile
      processAndSaveProfile();
    });

    vapi.on("message", (message: any) => {
      console.log("Received message:", message);
      // Handle messages to extract profile data
      extractProfileData(message);
    });

    vapi.on("error", (error: any) => {
      console.error("Vapi error details:", JSON.stringify(error, null, 2));
      setIsCallActive(false);
    });

    return () => {
      vapi.stop();
    };
  }, []);

  const extractProfileData = (message: any) => {
    const text = message.text || "";
    // Look for the JSON summary from the assistant
    const jsonMatch = text.match(/PROFILE_DATA:\s*(\{.*\})/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        setProfile(data);
      } catch (error) {
        console.error("Failed to parse profile data:", error);
      }
    }
  };

  const processAndSaveProfile = () => {
    // Validate and save the profile
    if (profile.name && profile.age && profile.location && profile.bio) {
      const romanticProfile: RomanticProfile = {
        id: `voice-${profile.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: profile.name,
        age: profile.age,
        genderIdentity: profile.genderIdentity || "",
        lookingFor: profile.lookingFor || "",
        location: profile.location,
        relationshipIntent: profile.relationshipIntent || "long-term",
        bio: profile.bio,
        interests: profile.interests || [],
        values: profile.values || [],
        communicationStyle: profile.communicationStyle || "balanced",
        lifestyleHabits: {
          sleepSchedule: profile.sleepSchedule || "flexible",
          socialEnergy: profile.socialEnergy || "balanced",
          activityLevel: profile.activityLevel || "active",
          drinking: profile.drinking || "social",
          smoking: profile.smoking || "never",
        },
        dealbreakers: profile.dealbreakers || [],
        idealFirstDate: profile.idealFirstDate || "",
        preferenceAgeRange: {
          min: profile.preferenceMinAge || 24,
          max: profile.preferenceMaxAge || 38,
        },
        preferenceNotes: profile.preferenceNotes || "",
        agentType: profile.agentType || "hosted",
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

    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;

    if (!assistantId) {
      console.error("VAPI_ASSISTANT_ID not found. Please set NEXT_PUBLIC_VAPI_ASSISTANT_ID in your environment variables.");
      return;
    }

    if (!apiKey) {
      console.error("VAPI_API_KEY not found. Please set NEXT_PUBLIC_VAPI_API_KEY in your environment variables.");
      return;
    }

    console.log("Starting voice onboarding with assistant:", assistantId);

    try {
      await vapiRef.current.start(assistantId);
      console.log("Vapi start successful");
    } catch (error) {
      console.error("Failed to start voice onboarding:", error);
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
          {!isCallActive && !isComplete && (
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
          )}

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