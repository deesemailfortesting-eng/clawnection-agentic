export type ParsedMessage = {
  timestamp: Date;
  sender: string;
  body: string;
  isSystem: boolean;
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
