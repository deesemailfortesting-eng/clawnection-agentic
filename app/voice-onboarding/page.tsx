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

    vapiRef.current = new Vapi(apiKey);

    // Set up event listeners
    const vapi = vapiRef.current;

    vapi.on("call-start", () => {
      setIsCallActive(true);
    });

    vapi.on("call-end", () => {
      setIsCallActive(false);
      // Process the collected data and save profile
      processAndSaveProfile();
    });

    vapi.on("message", (message: any) => {
      // Handle messages to extract profile data
      extractProfileData(message);
    });

    vapi.on("error", (error: any) => {
      console.error("Vapi error:", error);
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
    if (!vapiRef.current) return;

    const assistant = {
      name: "Clawnection Onboarding Assistant",
      model: {
        provider: "openai" as const,
        model: "gpt-4" as const,
        temperature: 0.7,
      },
      voice: {
        provider: "11labs" as const,
        voiceId: process.env.NEXT_PUBLIC_VAPI_VOICE_ID || "default-voice-id",
      },
      systemMessage: `You are a friendly onboarding assistant for Clawnection, an agentic matchmaking app.

Your task is to help users create their romantic profile by asking questions conversationally.

Ask for the following information in a natural order:
1. Name
2. Age
3. Gender identity
4. What they're looking for
5. Location
6. Relationship intent (long-term, serious dating, exploring, friendship first)
7. Short bio
8. Interests (comma-separated)
9. Values (comma-separated)
10. Communication style (balanced, direct, warm, playful, reflective)
11. Lifestyle: sleep schedule (early-bird, flexible, night-owl)
12. Social energy (low-key, balanced, high-energy)
13. Activity level (relaxed, active, very-active)
14. Drinking habits (never, social, regular)
15. Smoking habits (never, occasionally, regular)
16. Dealbreakers (comma-separated)
17. Ideal first date
18. Preferred age range (min and max)
19. Any additional preference notes
20. Agent type preference (hosted or external)

Be conversational and friendly. Confirm information and ask for clarification if needed.
Once all information is collected, summarize and ask if they want to proceed.

IMPORTANT: After collecting all information, output a JSON summary of the profile data in this exact format:
PROFILE_DATA: {"name": "...", "age": 25, ...}

Make sure to include all collected fields in the JSON.`,
    };

    try {
      await vapiRef.current.start(assistant);
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