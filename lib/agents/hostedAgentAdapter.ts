import { AgentAdapter, ClosingAssessmentInput } from "@/lib/agents/types";
import {
  RomanticProfile,
  VirtualDateRound,
  VirtualDateRoundType,
} from "@/lib/types/matching";

const roundLanguage: Record<VirtualDateRoundType, string> = {
  introductions: "established tone and baseline attraction factors",
  intentions: "checked intent alignment and timeline compatibility",
  lifestyle: "compared day-to-day rhythms and practical fit",
  values: "validated core principles and long-term priorities",
  communication: "tested conflict style and emotional expression",
  "fun-chemistry": "estimated playful energy and spontaneous rapport",
};

export class HostedAgentAdapter implements AgentAdapter {
  readonly type = "hosted" as const;

  getAgentSummary(profile: RomanticProfile): string {
    return `Hosted Clawnection agent for ${profile.name}: calibrated for ${profile.relationshipIntent} matchmaking, prioritizing ${profile.values.slice(0, 2).join(" and ")}.`;
  }

  participateInVirtualDate(
    self: RomanticProfile,
    counterpart: RomanticProfile,
    roundType: VirtualDateRoundType,
  ): Pick<VirtualDateRound, "summary" | "signal"> {
    const sharedInterests = self.interests.filter((interest) =>
      counterpart.interests.includes(interest),
    );
    const signal: VirtualDateRound["signal"] =
      sharedInterests.length >= 2
        ? "positive"
        : sharedInterests.length === 1
          ? "mixed"
          : "caution";

    return {
      summary: `Hosted agent ${roundLanguage[roundType]} and noted ${sharedInterests.length > 0 ? `shared interests in ${sharedInterests.slice(0, 2).join(" and ")}` : "few direct overlaps, requiring stronger intentional coordination"}.`,
      signal,
    };
  }

  generateClosingAssessment(
    self: RomanticProfile,
    counterpart: RomanticProfile,
    input: ClosingAssessmentInput,
  ): string {
    return `Hosted synthesis: ${self.name} and ${counterpart.name} scored ${input.score}/100 with strongest indicators around ${input.strengths.slice(0, 2).join("; ") || "baseline alignment"}. Key watchpoint: ${input.concerns[0]?.title ?? "none severe"}.`;
  }
}
