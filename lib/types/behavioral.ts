export type ParsedMessage = {
  timestamp: Date;
  sender: string;
  body: string;
  isSystem: boolean;
};

export type SignalConfidence = "low" | "medium" | "high";

export type SignalSensitivity = "shareable-summary" | "private-only";

export type WhatsAppSignalExtractionMetadata = {
  source: "whatsapp-export";
  fileCount: number;
  parseErrors: number;
  detectedFormats: Array<"ios" | "android" | "unknown">;
};

export type WhatsAppSignalFamilyMetadata = {
  confidence: SignalConfidence;
  sensitivity: SignalSensitivity;
  provenance: WhatsAppSignalExtractionMetadata & {
    userMessageCount: number;
    totalMessages: number;
  };
};

export type WhatsAppShareableSummary = {
  label: string;
  value: string;
  confidence: SignalConfidence;
};

export type WhatsAppSignals = {
  // Raw computed signals
  avgResponseLatencyMs: number;
  responseLatencyStdDevMs: number; // attachment consistency proxy: high stddev = inconsistent
  initiationRatio: number; // 0.0–1.0: fraction of conversation threads started by user
  avgMessageLength: number; // mean character count (media omitted treated as 0)
  longMessageRatio: number; // fraction of user messages with >50 chars
  emojiDensity: number; // emojis per message
  questionRatio: number; // fraction of user messages containing "?"
  hourlyDistribution: Record<number, number>; // hour 0–23 → message count

  // Close-tie stability: Jaccard similarity of top-3 contacts between first/second half of export
  closeTieStabilityScore: number; // 0.0–1.0

  // Derived categorical signals
  activeHoursProfile: "early-bird" | "night-owl" | "flexible";
  derivedCommunicationStyle: "direct" | "warm" | "playful" | "reflective" | "balanced";

  // Metadata
  totalMessages: number;
  userMessageCount: number;
  uniqueContacts: number;
  isLowConfidence: boolean; // true if userMessageCount < 20
  exportDateRange: { earliest: Date; latest: Date };
  analysedAt: Date;

  // Schema-alignment metadata
  extractionMetadata: WhatsAppSignalExtractionMetadata;
  signalFamilyMetadata: {
    communicationStyle: WhatsAppSignalFamilyMetadata;
    responsiveness: WhatsAppSignalFamilyMetadata;
    activeHours: WhatsAppSignalFamilyMetadata;
    relationshipPatterns: WhatsAppSignalFamilyMetadata;
  };
  shareableSummary: WhatsAppShareableSummary[];
};

export type SelfAwarenessGap = {
  statedCommunicationStyle: string;
  derivedCommunicationStyle: string;
  statedSleepSchedule: string;
  derivedSleepSchedule: string;
  communicationStyleMatch: boolean;
  sleepScheduleMatch: boolean;
  gapScore: number; // 0.0–1.0: fraction of measured fields that differ
};
