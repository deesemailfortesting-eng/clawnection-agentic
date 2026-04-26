import { MatchResult, RomanticProfile } from "@/lib/types/matching";
import { SelfAwarenessGap, WhatsAppSignals } from "@/lib/types/behavioral";

export const LOCAL_PROFILE_KEY = "clawnection.profile.v1";
export const LOCAL_RESULT_KEY = "clawnection.lastResult.v1";
export const LOCAL_SIGNALS_KEY = "clawnection.signals.v1";
const LOCAL_GAP_KEY = "clawnection.selfAwarenessGap.v1";

export function saveProfile(profile: RomanticProfile) {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): RomanticProfile | null {
  const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RomanticProfile;
  } catch {
    return null;
  }
}

export function saveResult(result: MatchResult) {
  localStorage.setItem(LOCAL_RESULT_KEY, JSON.stringify(result));
}

export function loadResult(): MatchResult | null {
  const raw = localStorage.getItem(LOCAL_RESULT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MatchResult;
  } catch {
    return null;
  }
}

export function saveSignals(signals: WhatsAppSignals): void {
  localStorage.setItem(LOCAL_SIGNALS_KEY, JSON.stringify(signals));
}

export function loadSignals(): WhatsAppSignals | null {
  const raw = localStorage.getItem(LOCAL_SIGNALS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as WhatsAppSignals;
    // Revive Date objects lost in JSON round-trip
    parsed.exportDateRange.earliest = new Date(parsed.exportDateRange.earliest);
    parsed.exportDateRange.latest = new Date(parsed.exportDateRange.latest);
    parsed.analysedAt = new Date(parsed.analysedAt);

    if (!parsed.extractionMetadata) {
      parsed.extractionMetadata = {
        source: "whatsapp-export",
        fileCount: 1,
        parseErrors: 0,
        detectedFormats: ["unknown"],
      };
    }

    if (!parsed.signalFamilyMetadata) {
      parsed.signalFamilyMetadata = {
        communicationStyle: {
          confidence: parsed.isLowConfidence ? "low" : "medium",
          sensitivity: "shareable-summary",
          provenance: {
            ...parsed.extractionMetadata,
            userMessageCount: parsed.userMessageCount,
            totalMessages: parsed.totalMessages,
          },
        },
        responsiveness: {
          confidence: parsed.isLowConfidence ? "low" : "medium",
          sensitivity: "shareable-summary",
          provenance: {
            ...parsed.extractionMetadata,
            userMessageCount: parsed.userMessageCount,
            totalMessages: parsed.totalMessages,
          },
        },
        activeHours: {
          confidence: parsed.isLowConfidence ? "low" : "medium",
          sensitivity: "shareable-summary",
          provenance: {
            ...parsed.extractionMetadata,
            userMessageCount: parsed.userMessageCount,
            totalMessages: parsed.totalMessages,
          },
        },
        relationshipPatterns: {
          confidence: parsed.isLowConfidence ? "low" : "medium",
          sensitivity: "private-only",
          provenance: {
            ...parsed.extractionMetadata,
            userMessageCount: parsed.userMessageCount,
            totalMessages: parsed.totalMessages,
          },
        },
      };
    }

    if (!parsed.shareableSummary) {
      parsed.shareableSummary = [];
    }

    if (!parsed.coverageSummary) {
      parsed.coverageSummary = {
        conversationCount: 0,
        eligibleConversationCount: 0,
        messageCount: parsed.totalMessages,
        ownerMessageCount: parsed.userMessageCount,
        otherMessageCount: Math.max(0, parsed.totalMessages - parsed.userMessageCount),
        dateRangeStart: parsed.exportDateRange.earliest,
        dateRangeEnd: parsed.exportDateRange.latest,
        coverageQuality: parsed.isLowConfidence ? "low" : "medium",
        warnings: [],
      };
    }

    parsed.coverageSummary.dateRangeStart = new Date(parsed.coverageSummary.dateRangeStart);
    parsed.coverageSummary.dateRangeEnd = new Date(parsed.coverageSummary.dateRangeEnd);

    if (!parsed.conversationProfiles) {
      parsed.conversationProfiles = [];
    }

    if (!parsed.globalProfile) {
      parsed.globalProfile = {
        coverage: parsed.coverageSummary,
        shareableSummaryCandidates: parsed.shareableSummary.map((summary) => ({
          summaryKey: summary.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          summaryText: summary.value,
          sourceSignalKeys: [summary.label],
          confidence: summary.confidence,
          approvedForAgentSharing: true,
        })),
        privateOnlySignals: [],
      };
    } else {
      parsed.globalProfile.coverage.dateRangeStart = new Date(parsed.globalProfile.coverage.dateRangeStart);
      parsed.globalProfile.coverage.dateRangeEnd = new Date(parsed.globalProfile.coverage.dateRangeEnd);
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveGap(gap: SelfAwarenessGap): void {
  localStorage.setItem(LOCAL_GAP_KEY, JSON.stringify(gap));
}

export function loadGap(): SelfAwarenessGap | null {
  const raw = localStorage.getItem(LOCAL_GAP_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SelfAwarenessGap;
  } catch {
    return null;
  }
}
