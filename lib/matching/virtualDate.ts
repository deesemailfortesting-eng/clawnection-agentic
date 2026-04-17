import { HostedAgentAdapter } from "@/lib/agents/hostedAgentAdapter";
import { MockExternalAgentAdapter } from "@/lib/agents/mockExternalAgentAdapter";
import { AgentAdapter } from "@/lib/agents/types";
import {
  Concern,
  MatchResult,
  Recommendation,
  RomanticProfile,
  VirtualDateRound,
  VirtualDateRoundType,
} from "@/lib/types/matching";

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

function getAdapter(type: RomanticProfile["agentType"]): AgentAdapter {
  return type === "hosted" ? new HostedAgentAdapter() : new MockExternalAgentAdapter();
}

function overlap(a: string[], b: string[]) {
  return a.filter((item) => b.includes(item));
}

function hasDealbreakerConflict(a: RomanticProfile, b: RomanticProfile) {
  const bText = `${b.bio} ${b.interests.join(" ")} ${b.values.join(" ")} ${b.lifestyleHabits.smoking}`.toLowerCase();
  return a.dealbreakers.some((dealbreaker) => bText.includes(dealbreaker.toLowerCase()));
}

function scoreProfiles(a: RomanticProfile, b: RomanticProfile) {
  let score = 50;
  const strengths: string[] = [];
  const concerns: Concern[] = [];

  const sharedInterests = overlap(a.interests, b.interests);
  const sharedValues = overlap(a.values, b.values);
  const intentMatch = a.relationshipIntent === b.relationshipIntent;
  const communicationMatch = a.communicationStyle === b.communicationStyle;
  const locationMatch = a.location.split(",").pop()?.trim() === b.location.split(",").pop()?.trim();

  score += Math.min(sharedInterests.length * 6, 18);
  score += Math.min(sharedValues.length * 8, 24);

  if (intentMatch) {
    score += 12;
    strengths.push("Aligned relationship intent and pacing expectations.");
  } else {
    score -= 8;
    concerns.push({
      title: "Intent mismatch",
      detail: `${a.name} seeks ${a.relationshipIntent} while ${b.name} currently prefers ${b.relationshipIntent}.`,
      severity: "medium",
    });
  }

  if (communicationMatch) {
    score += 8;
    strengths.push(`Compatible communication style (${a.communicationStyle}).`);
  } else {
    score -= 4;
    concerns.push({
      title: "Communication style gap",
      detail: `${a.name} tends to be ${a.communicationStyle}, while ${b.name} is more ${b.communicationStyle}.`,
      severity: "low",
    });
  }

  if (locationMatch) {
    score += 6;
    strengths.push("Same metro area, making low-friction first meetings easier.");
  }

  const ageFits =
    a.age >= b.preferenceAgeRange.min &&
    a.age <= b.preferenceAgeRange.max &&
    b.age >= a.preferenceAgeRange.min &&
    b.age <= a.preferenceAgeRange.max;

  if (ageFits) {
    score += 6;
  } else {
    score -= 10;
    concerns.push({
      title: "Preference age range misalignment",
      detail: "One or both profiles fall outside preferred age range boundaries.",
      severity: "medium",
    });
  }

  const smokingConflict =
    (a.dealbreakers.some((d) => d.toLowerCase().includes("smoking")) && b.lifestyleHabits.smoking !== "never") ||
    (b.dealbreakers.some((d) => d.toLowerCase().includes("smoking")) && a.lifestyleHabits.smoking !== "never");

  if (smokingConflict) {
    score -= 18;
    concerns.push({
      title: "Lifestyle dealbreaker conflict",
      detail: "Smoking preference conflicts with at least one profile's stated dealbreakers.",
      severity: "high",
    });
  }

  if (hasDealbreakerConflict(a, b) || hasDealbreakerConflict(b, a)) {
    score -= 12;
    concerns.push({
      title: "Potential dealbreaker trigger",
      detail: "At least one dealbreaker appears in counterpart profile language and should be human-reviewed.",
      severity: "high",
    });
  }

  if (sharedInterests.length > 0) {
    strengths.push(`Shared interests: ${sharedInterests.slice(0, 3).join(", ")}.`);
  }

  if (sharedValues.length > 0) {
    strengths.push(`Shared values: ${sharedValues.slice(0, 3).join(", ")}.`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    strengths: strengths.slice(0, 4),
    concerns: concerns.slice(0, 4),
    sharedInterests,
  };
}

function buildRecommendation(score: number, concerns: Concern[]): Recommendation {
  if (score >= 75 && concerns.every((concern) => concern.severity !== "high")) {
    return {
      verdict: "meet",
      rationale: "Strong alignment across intent, values, and practical lifestyle compatibility.",
      humanDecisionReminder:
        "Agents recommend moving forward, but both humans should review boundaries and comfort first.",
    };
  }

  if (score >= 55) {
    return {
      verdict: "maybe",
      rationale: "Promising overlap with a few friction points worth discussing before an in-person date.",
      humanDecisionReminder:
        "Use this as a structured starting point—humans should decide whether concerns feel manageable.",
    };
  }

  return {
    verdict: "not-recommended",
    rationale: "Multiple mismatch signals suggest low-likelihood in-person compatibility right now.",
    humanDecisionReminder:
      "This is only a recommendation. Humans can still choose to connect if context has changed.",
  };
}

function suggestFirstDate(a: RomanticProfile, b: RomanticProfile, sharedInterests: string[]) {
  const theme =
    sharedInterests[0] ?? (a.lifestyleHabits.socialEnergy === "low-key" || b.lifestyleHabits.socialEnergy === "low-key"
      ? "quiet conversation"
      : "interactive activity");

  return {
    idea:
      theme === "cooking"
        ? "Visit a local market, then cook a simple meal together."
        : theme === "hiking"
          ? "Take a scenic afternoon walk and grab tea afterward."
          : theme === "quiet conversation"
            ? "Meet at a calm café with a short neighborhood walk."
            : `Plan a ${theme}-inspired date followed by a casual meal.`,
    whyItFits: `The date format supports both ${a.name} and ${b.name}'s preference for ${theme}.`,
    logisticsNote: `Keep the first meeting to 60–90 minutes in ${a.location.split(",").pop()?.trim() || "a mutual neighborhood"} to reduce pressure.`,
  };
}

export function runVirtualDateSimulation(profileA: RomanticProfile, profileB: RomanticProfile): MatchResult {
  const adapterA = getAdapter(profileA.agentType);
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

  const evaluated = scoreProfiles(profileA, profileB);
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
