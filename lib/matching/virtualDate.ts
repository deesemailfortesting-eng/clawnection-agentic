import { HostedAgentAdapter } from "@/lib/agents/hostedAgentAdapter";
import { MockExternalAgentAdapter } from "@/lib/agents/mockExternalAgentAdapter";
import { AgentAdapter } from "@/lib/agents/types";
import {
  MatchResult,
  RomanticProfile,
  VirtualDateRound,
  VirtualDateRoundType,
} from "@/lib/types/matching";
import { WhatsAppSignals } from "@/lib/types/behavioral";
import { loadSignals } from "@/lib/storage";
import { scoreProfiles, buildRecommendation, suggestFirstDate } from "./scoring";

const ROUND_TITLES: Record<VirtualDateRoundType, string> = {
  introductions: "Round 1 · Introductions",
  intentions: "Round 2 · Intentions",
  lifestyle: "Round 3 · Lifestyle",
  values: "Round 4 · Values",
  communication: "Round 5 · Communication",
  "fun-chemistry": "Round 6 · Fun & Chemistry",
};

const ROUND_ORDER: VirtualDateRoundType[] = [
  "introductions",
  "intentions",
  "lifestyle",
  "values",
  "communication",
  "fun-chemistry",
];

function getAdapter(type: RomanticProfile["agentType"], signals?: WhatsAppSignals | null): AgentAdapter {
  if (type === "hosted") return new HostedAgentAdapter(signals ?? null);
  return new MockExternalAgentAdapter();
}

export function runVirtualDateSimulation(profileA: RomanticProfile, profileB: RomanticProfile): MatchResult {
  const signalsA = loadSignals();
  const adapterA = getAdapter(profileA.agentType, signalsA);
  const adapterB = getAdapter(profileB.agentType);

  const rounds: VirtualDateRound[] = ROUND_ORDER.map((type, index) => {
    const aTake = adapterA.participateInVirtualDate(profileA, profileB, type);
    const bTake = adapterB.participateInVirtualDate(profileB, profileA, type);

    const signalOrder = { caution: 0, mixed: 1, positive: 2 };
    const avgSignal = (signalOrder[aTake.signal] + signalOrder[bTake.signal]) / 2;
    const signal = avgSignal >= 1.5 ? "positive" : avgSignal >= 0.5 ? "mixed" : "caution";

    return {
      round: index + 1,
      type,
      title: ROUND_TITLES[type],
      summary: `${aTake.summary} ${bTake.summary}`,
      signal,
    };
  });

  const evaluated = scoreProfiles(profileA, profileB, signalsA);
  const recommendation = buildRecommendation(evaluated.score, evaluated.concerns);
  const firstDateSuggestion = suggestFirstDate(profileA, profileB, evaluated.sharedInterests);

  const closingA = adapterA.generateClosingAssessment(profileA, profileB, {
    strengths: evaluated.strengths,
    concerns: evaluated.concerns,
    score: evaluated.score,
  });
  const closingB = adapterB.generateClosingAssessment(profileB, profileA, {
    strengths: evaluated.strengths,
    concerns: evaluated.concerns,
    score: evaluated.score,
  });

  return {
    profileA,
    profileB,
    compatibilityScore: evaluated.score,
    strengths: evaluated.strengths.length
      ? evaluated.strengths
      : ["Baseline conversational compatibility detected."],
    concerns: evaluated.concerns,
    rounds,
    firstDateSuggestion,
    closingAssessment: `${closingA} ${closingB}`,
    recommendation,
  };
}
