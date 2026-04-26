import {
  ParsedMessage,
  SignalConfidence,
  SignalSensitivity,
  WhatsAppConversationSignalProfile,
  WhatsAppCoverageSummary,
  WhatsAppSignalExtractionMetadata,
  WhatsAppSignalFamilyMetadata,
  WhatsAppGlobalSignalProfile,
  WhatsAppSignals,
} from "@/lib/types/behavioral";

const THREAD_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours = new conversation thread
const MAX_LATENCY_MS = 24 * 60 * 60 * 1000; // 24h cap to exclude offline gaps
const LOW_CONFIDENCE_THRESHOLD = 20;

// Unicode emoji regex (requires u flag)
const EMOJI_RE = /\p{Emoji_Presentation}/gu;

type ExtractSignalOptions = {
  extractionMetadata?: Partial<WhatsAppSignalExtractionMetadata>;
  conversationId?: string;
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function normalizedSenderName(name: string): string {
  return name.trim().toLowerCase();
}

function getConfidence(userMessageCount: number): SignalConfidence {
  if (userMessageCount < LOW_CONFIDENCE_THRESHOLD) return "low";
  if (userMessageCount < 75) return "medium";
  return "high";
}

function buildExtractionMetadata(
  userMessageCount: number,
  totalMessages: number,
  metadata?: Partial<WhatsAppSignalExtractionMetadata>,
): WhatsAppSignalExtractionMetadata {
  return {
    source: "whatsapp-export",
    fileCount: metadata?.fileCount ?? 1,
    parseErrors: metadata?.parseErrors ?? 0,
    detectedFormats: metadata?.detectedFormats?.length ? metadata.detectedFormats : ["unknown"],
  };
}

function buildFamilyMetadata(
  userMessageCount: number,
  totalMessages: number,
  extractionMetadata: WhatsAppSignalExtractionMetadata,
  sensitivity: SignalSensitivity,
): WhatsAppSignalFamilyMetadata {
  return {
    confidence: getConfidence(userMessageCount),
    sensitivity,
    provenance: {
      ...extractionMetadata,
      userMessageCount,
      totalMessages,
    },
  };
}

function getResponseSpeedLabel(avgResponseLatencyMs: number): string {
  if (avgResponseLatencyMs === 0) return "insufficient response data";
  if (avgResponseLatencyMs < 30 * 60 * 1000) return "typically replies quickly";
  if (avgResponseLatencyMs < 3 * 60 * 60 * 1000) return "usually replies within a few hours";
  return "often replies on a slower cadence";
}

function buildShareableSummary(signals: Pick<WhatsAppSignals,
  "derivedCommunicationStyle" |
  "activeHoursProfile" |
  "avgResponseLatencyMs" |
  "signalFamilyMetadata"
>): WhatsAppSignals["shareableSummary"] {
  return [
    {
      label: "Communication style",
      value: signals.derivedCommunicationStyle,
      confidence: signals.signalFamilyMetadata.communicationStyle.confidence,
    },
    {
      label: "Active hours",
      value: signals.activeHoursProfile,
      confidence: signals.signalFamilyMetadata.activeHours.confidence,
    },
    {
      label: "Reply cadence",
      value: getResponseSpeedLabel(signals.avgResponseLatencyMs),
      confidence: signals.signalFamilyMetadata.responsiveness.confidence,
    },
  ];
}

function slugifyConversationId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "conversation";
}

function uniqueActiveDays(messages: ParsedMessage[]): number {
  return new Set(messages.map((message) => message.timestamp.toISOString().slice(0, 10))).size;
}

function getCoverageQuality(ownerMessageCount: number, totalMessages: number): SignalConfidence {
  if (ownerMessageCount < LOW_CONFIDENCE_THRESHOLD || totalMessages < LOW_CONFIDENCE_THRESHOLD * 2) return "low";
  if (ownerMessageCount < 75 || totalMessages < 150) return "medium";
  return "high";
}

function buildCoverageSummary(
  conversationProfiles: WhatsAppConversationSignalProfile[],
  totalMessages: number,
  ownerMessageCount: number,
  dateRangeStart: Date,
  dateRangeEnd: Date,
): WhatsAppCoverageSummary {
  const eligibleConversationCount = conversationProfiles.filter((profile) => profile.coverage.isSignalEligible).length;
  const otherMessageCount = Math.max(0, totalMessages - ownerMessageCount);
  const coverageQuality = getCoverageQuality(ownerMessageCount, totalMessages);
  const warnings: string[] = [];

  if (coverageQuality === "low") {
    warnings.push("Signal confidence is limited because the conversation coverage is still thin.");
  }
  if (eligibleConversationCount === 0 && conversationProfiles.length > 0) {
    warnings.push("No conversation yet meets the current eligibility threshold for strong signal interpretation.");
  }

  return {
    conversationCount: conversationProfiles.length,
    eligibleConversationCount,
    messageCount: totalMessages,
    ownerMessageCount,
    otherMessageCount,
    dateRangeStart,
    dateRangeEnd,
    coverageQuality,
    warnings,
  };
}

function buildConversationProfile(
  messages: ParsedMessage[],
  userName: string,
  conversationId: string,
): WhatsAppConversationSignalProfile {
  const nonSystem = messages.filter((message) => !message.isSystem);
  const userNorm = normalizedSenderName(userName);
  const ownerMessages = nonSystem.filter((message) => normalizedSenderName(message.sender) === userNorm);
  const otherMessages = nonSystem.filter((message) => normalizedSenderName(message.sender) !== userNorm);
  const latencies = computeResponseLatencies(nonSystem, userName);
  const avgResponseLatencyMs = mean(latencies);
  const uniqueOtherParticipants = new Set(otherMessages.map((message) => normalizedSenderName(message.sender)));
  const participantCount = uniqueOtherParticipants.size + 1;
  const confidence = getCoverageQuality(ownerMessages.length, nonSystem.length);

  return {
    conversationId,
    participantCount,
    inferredRelationshipType: uniqueOtherParticipants.size > 1 ? "group-chat" : "direct-message",
    coverage: {
      messageCount: nonSystem.length,
      ownerMessageCount: ownerMessages.length,
      otherMessageCount: otherMessages.length,
      activeDays: uniqueActiveDays(nonSystem),
      isSignalEligible: ownerMessages.length >= 5 && otherMessages.length >= 5 && nonSystem.length >= 20,
      confidence,
    },
    communicationStyle: {
      derivedStyle: deriveCommunicationStyle(
        ownerMessages.length === 0 ? 0 : ownerMessages.filter((message) => message.body.includes("?")).length / ownerMessages.length,
        computeEmojiDensity(ownerMessages),
        ownerMessages.length === 0 ? 0 : ownerMessages.filter((message) => message.body.length > 50).length / ownerMessages.length,
        mean(ownerMessages.map((message) => message.body === "<Media omitted>" || message.body === "‎<Media omitted>" ? 0 : message.body.length)),
        computeInitiationRatio(nonSystem, userName),
      ),
      avgResponseLatencyMs,
      initiationRatio: computeInitiationRatio(nonSystem, userName),
      longMessageRatio: ownerMessages.length === 0 ? 0 : ownerMessages.filter((message) => message.body.length > 50).length / ownerMessages.length,
      emojiDensity: computeEmojiDensity(ownerMessages),
    },
    attachmentPattern: {
      closeTieStabilityScore: computeCloseTieStability(nonSystem, userName),
      responseConsistency: avgResponseLatencyMs === 0 ? "low" : getConfidence(ownerMessages.length),
    },
    policyTags: uniqueOtherParticipants.size > 1 ? ["private-only"] : ["shareable-summary"],
  };
}

function buildGlobalProfile(
  coverageSummary: WhatsAppCoverageSummary,
  shareableSummary: WhatsAppSignals["shareableSummary"],
  closeTieStabilityScore: number,
): WhatsAppGlobalSignalProfile {
  return {
    coverage: coverageSummary,
    shareableSummaryCandidates: shareableSummary.map((summary) => ({
      summaryKey: summary.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      summaryText: summary.value,
      sourceSignalKeys: [summary.label],
      confidence: summary.confidence,
      approvedForAgentSharing: true,
    })),
    privateOnlySignals: [
      {
        signalKey: "close_tie_stability",
        value: closeTieStabilityScore.toFixed(2),
        reason: "Internal relationship-pattern signal used for downstream reasoning only.",
        sensitivityClass: "private-only",
      },
    ],
  };
}

function computeResponseLatencies(messages: ParsedMessage[], userName: string): number[] {
  const userNorm = normalizedSenderName(userName);
  const nonSystem = messages.filter((m) => !m.isSystem);
  const latencies: number[] = [];

  for (let i = 1; i < nonSystem.length; i++) {
    const curr = nonSystem[i];
    if (normalizedSenderName(curr.sender) !== userNorm) continue;

    // Find the last non-user message before this user message
    let j = i - 1;
    while (j >= 0 && normalizedSenderName(nonSystem[j].sender) === userNorm) {
      j--;
    }
    if (j < 0) continue;

    const latencyMs = curr.timestamp.getTime() - nonSystem[j].timestamp.getTime();
    if (latencyMs > 0 && latencyMs <= MAX_LATENCY_MS) {
      latencies.push(latencyMs);
    }
  }

  return latencies;
}

function computeInitiationRatio(messages: ParsedMessage[], userName: string): number {
  const userNorm = normalizedSenderName(userName);
  const nonSystem = messages.filter((m) => !m.isSystem);
  if (nonSystem.length === 0) return 0;

  let totalThreadStarts = 0;
  let userThreadStarts = 0;

  for (let i = 0; i < nonSystem.length; i++) {
    const isThreadStart =
      i === 0 ||
      nonSystem[i].timestamp.getTime() - nonSystem[i - 1].timestamp.getTime() > THREAD_GAP_MS;

    if (isThreadStart) {
      totalThreadStarts++;
      if (normalizedSenderName(nonSystem[i].sender) === userNorm) {
        userThreadStarts++;
      }
    }
  }

  return totalThreadStarts === 0 ? 0 : userThreadStarts / totalThreadStarts;
}

function countEmojis(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

function computeEmojiDensity(userMessages: ParsedMessage[]): number {
  if (userMessages.length === 0) return 0;
  const total = userMessages.reduce((sum, m) => sum + countEmojis(m.body), 0);
  return total / userMessages.length;
}

function computeHourlyDistribution(userMessages: ParsedMessage[]): Record<number, number> {
  const dist: Record<number, number> = {};
  for (let h = 0; h < 24; h++) dist[h] = 0;
  for (const m of userMessages) {
    dist[m.timestamp.getHours()]++;
  }
  return dist;
}

function deriveActiveHoursProfile(
  dist: Record<number, number>,
  total: number,
): WhatsAppSignals["activeHoursProfile"] {
  if (total === 0) return "flexible";

  const morningMass = [5, 6, 7, 8, 9, 10].reduce((sum, h) => sum + (dist[h] ?? 0), 0);
  const eveningMass = [21, 22, 23, 0, 1].reduce((sum, h) => sum + (dist[h] ?? 0), 0);

  const morningFraction = morningMass / total;
  const eveningFraction = eveningMass / total;

  if (morningFraction > 0.4 || (morningMass > 0 && morningMass > eveningMass * 1.5)) {
    return "early-bird";
  }
  if (eveningFraction > 0.35 || (eveningMass > 0 && eveningMass > morningMass * 1.5)) {
    return "night-owl";
  }
  return "flexible";
}

function deriveCommunicationStyle(
  questionRatio: number,
  emojiDensity: number,
  longMessageRatio: number,
  avgMessageLength: number,
  initiationRatio: number,
): WhatsAppSignals["derivedCommunicationStyle"] {
  const scores: Record<string, number> = {
    direct: 0,
    warm: 0,
    playful: 0,
    reflective: 0,
    balanced: 0,
  };

  if (questionRatio > 0.25) { scores.reflective += 2; scores.warm += 1; }
  if (questionRatio < 0.08) { scores.direct += 2; }

  if (emojiDensity > 1.5) { scores.playful += 3; }
  else if (emojiDensity >= 0.5) { scores.warm += 1; }
  else if (emojiDensity < 0.2) { scores.direct += 1; }

  if (longMessageRatio > 0.5) { scores.reflective += 3; }
  else if (longMessageRatio >= 0.3) { scores.warm += 1; }

  if (avgMessageLength < 30) { scores.direct += 2; scores.playful += 1; }
  else if (avgMessageLength > 100) { scores.reflective += 2; }

  if (initiationRatio > 0.55) { scores.direct += 1; scores.warm += 1; }
  if (initiationRatio < 0.35) { scores.reflective += 1; }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topStyle, topScore] = sorted[0];
  const [, secondScore] = sorted[1] ?? ["", 0];

  // Tie → balanced
  if (topScore === secondScore || topScore === 0) return "balanced";
  return topStyle as WhatsAppSignals["derivedCommunicationStyle"];
}

function computeCloseTieStability(messages: ParsedMessage[], userName: string): number {
  const userNorm = normalizedSenderName(userName);
  const nonSystem = messages.filter((m) => !m.isSystem);
  if (nonSystem.length < 2) return 1;

  const midTime =
    (nonSystem[0].timestamp.getTime() + nonSystem[nonSystem.length - 1].timestamp.getTime()) / 2;

  const contactCounts = (half: ParsedMessage[]) => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < half.length; i++) {
      const msg = half[i];
      if (normalizedSenderName(msg.sender) !== userNorm) continue;
      // Find who the user replied to: look back for last non-user message
      let j = i - 1;
      while (j >= 0 && normalizedSenderName(half[j].sender) === userNorm) j--;
      if (j >= 0) {
        const contact = normalizedSenderName(half[j].sender);
        counts[contact] = (counts[contact] ?? 0) + 1;
      }
    }
    return counts;
  };

  const firstHalf = nonSystem.filter((m) => m.timestamp.getTime() < midTime);
  const secondHalf = nonSystem.filter((m) => m.timestamp.getTime() >= midTime);

  const top3 = (counts: Record<string, number>): Set<string> => {
    return new Set(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k),
    );
  };

  const set1 = top3(contactCounts(firstHalf));
  const set2 = top3(contactCounts(secondHalf));

  if (set1.size === 0 || set2.size === 0) return 1;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

export function mergeSignals(signalsList: WhatsAppSignals[]): WhatsAppSignals {
  if (signalsList.length === 0) throw new Error("No signals to merge");
  if (signalsList.length === 1) return signalsList[0];

  const totalUserMessages = signalsList.reduce((sum, s) => sum + s.userMessageCount, 0);

  function weightedMean(getter: (s: WhatsAppSignals) => number): number {
    if (totalUserMessages === 0) return 0;
    return signalsList.reduce((sum, s) => sum + getter(s) * s.userMessageCount, 0) / totalUserMessages;
  }

  // Sum hourly distributions across all chats
  const mergedHourlyDist: Record<number, number> = {};
  for (let h = 0; h < 24; h++) mergedHourlyDist[h] = 0;
  for (const s of signalsList) {
    for (let h = 0; h < 24; h++) {
      mergedHourlyDist[h] += s.hourlyDistribution[h] ?? 0;
    }
  }

  const avgResponseLatencyMs = weightedMean((s) => s.avgResponseLatencyMs);
  const responseLatencyStdDevMs = weightedMean((s) => s.responseLatencyStdDevMs);
  const initiationRatio = weightedMean((s) => s.initiationRatio);
  const avgMessageLength = weightedMean((s) => s.avgMessageLength);
  const longMessageRatio = weightedMean((s) => s.longMessageRatio);
  const emojiDensity = weightedMean((s) => s.emojiDensity);
  const questionRatio = weightedMean((s) => s.questionRatio);
  const closeTieStabilityScore = weightedMean((s) => s.closeTieStabilityScore);

  // Re-derive categorical signals from merged numeric values
  const activeHoursProfile = deriveActiveHoursProfile(mergedHourlyDist, totalUserMessages);
  const derivedCommunicationStyle = deriveCommunicationStyle(
    questionRatio,
    emojiDensity,
    longMessageRatio,
    avgMessageLength,
    initiationRatio,
  );

  const allEarliest = signalsList.map((s) => s.exportDateRange.earliest.getTime());
  const allLatest = signalsList.map((s) => s.exportDateRange.latest.getTime());

  const extractionMetadata: WhatsAppSignalExtractionMetadata = {
    source: "whatsapp-export",
    fileCount: signalsList.reduce((sum, s) => sum + s.extractionMetadata.fileCount, 0),
    parseErrors: signalsList.reduce((sum, s) => sum + s.extractionMetadata.parseErrors, 0),
    detectedFormats: [...new Set(signalsList.flatMap((s) => s.extractionMetadata.detectedFormats))],
  };

  const signalFamilyMetadata = {
    communicationStyle: buildFamilyMetadata(totalUserMessages, signalsList.reduce((sum, s) => sum + s.totalMessages, 0), extractionMetadata, "shareable-summary"),
    responsiveness: buildFamilyMetadata(totalUserMessages, signalsList.reduce((sum, s) => sum + s.totalMessages, 0), extractionMetadata, "shareable-summary"),
    activeHours: buildFamilyMetadata(totalUserMessages, signalsList.reduce((sum, s) => sum + s.totalMessages, 0), extractionMetadata, "shareable-summary"),
    relationshipPatterns: buildFamilyMetadata(totalUserMessages, signalsList.reduce((sum, s) => sum + s.totalMessages, 0), extractionMetadata, "private-only"),
  };

  const totalMessages = signalsList.reduce((sum, s) => sum + s.totalMessages, 0);
  const conversationProfiles = signalsList.flatMap((signal) => signal.conversationProfiles);
  const coverageSummary = buildCoverageSummary(
    conversationProfiles,
    totalMessages,
    totalUserMessages,
    new Date(Math.min(...allEarliest)),
    new Date(Math.max(...allLatest)),
  );

  const mergedSignals: WhatsAppSignals = {
    avgResponseLatencyMs,
    responseLatencyStdDevMs,
    initiationRatio,
    avgMessageLength,
    longMessageRatio,
    emojiDensity,
    questionRatio,
    hourlyDistribution: mergedHourlyDist,
    closeTieStabilityScore,
    activeHoursProfile,
    derivedCommunicationStyle,
    totalMessages,
    userMessageCount: totalUserMessages,
    uniqueContacts: signalsList.reduce((sum, s) => sum + s.uniqueContacts, 0),
    isLowConfidence: totalUserMessages < LOW_CONFIDENCE_THRESHOLD,
    exportDateRange: {
      earliest: new Date(Math.min(...allEarliest)),
      latest: new Date(Math.max(...allLatest)),
    },
    analysedAt: new Date(),
    extractionMetadata,
    signalFamilyMetadata,
    shareableSummary: [],
    coverageSummary,
    conversationProfiles,
    globalProfile: {
      coverage: coverageSummary,
      shareableSummaryCandidates: [],
      privateOnlySignals: [],
    },
  };

  mergedSignals.shareableSummary = buildShareableSummary(mergedSignals);
  mergedSignals.globalProfile = buildGlobalProfile(
    coverageSummary,
    mergedSignals.shareableSummary,
    mergedSignals.closeTieStabilityScore,
  );

  return mergedSignals;
}

export function extractSignals(
  messages: ParsedMessage[],
  userName: string,
  options?: ExtractSignalOptions,
): WhatsAppSignals {
  const userNorm = normalizedSenderName(userName);
  const userMessages = messages.filter(
    (m) => !m.isSystem && normalizedSenderName(m.sender) === userNorm,
  );

  // Message lengths (treat "<Media omitted>" as length 0)
  const messageLengths = userMessages.map((m) =>
    m.body === "<Media omitted>" || m.body === "‎<Media omitted>" ? 0 : m.body.length,
  );

  const avgMessageLength = mean(messageLengths);
  const longMessageRatio =
    userMessages.length === 0
      ? 0
      : messageLengths.filter((l) => l > 50).length / userMessages.length;

  const questionRatio =
    userMessages.length === 0
      ? 0
      : userMessages.filter((m) => m.body.includes("?")).length / userMessages.length;

  const emojiDensity = computeEmojiDensity(userMessages);
  const hourlyDist = computeHourlyDistribution(userMessages);
  const initiationRatio = computeInitiationRatio(messages, userName);

  const latencies = computeResponseLatencies(messages, userName);
  const avgLatencyMs = mean(latencies);
  const stdDevLatencyMs = stdDev(latencies);

  const closeTieStabilityScore = computeCloseTieStability(messages, userName);

  const activeHoursProfile = deriveActiveHoursProfile(hourlyDist, userMessages.length);
  const derivedCommunicationStyle = deriveCommunicationStyle(
    questionRatio,
    emojiDensity,
    longMessageRatio,
    avgMessageLength,
    initiationRatio,
  );

  const allNonSystem = messages.filter((m) => !m.isSystem);
  const uniqueContacts = new Set(
    allNonSystem
      .filter((m) => normalizedSenderName(m.sender) !== userNorm)
      .map((m) => normalizedSenderName(m.sender)),
  ).size;

  const timestamps = allNonSystem.map((m) => m.timestamp.getTime()).filter((t) => !isNaN(t));
  const earliest = timestamps.length ? new Date(Math.min(...timestamps)) : new Date();
  const latest = timestamps.length ? new Date(Math.max(...timestamps)) : new Date();

  const totalMessages = messages.filter((m) => !m.isSystem).length;
  const extractionMetadata = buildExtractionMetadata(
    userMessages.length,
    totalMessages,
    options?.extractionMetadata,
  );

  const signalFamilyMetadata = {
    communicationStyle: buildFamilyMetadata(userMessages.length, totalMessages, extractionMetadata, "shareable-summary"),
    responsiveness: buildFamilyMetadata(userMessages.length, totalMessages, extractionMetadata, "shareable-summary"),
    activeHours: buildFamilyMetadata(userMessages.length, totalMessages, extractionMetadata, "shareable-summary"),
    relationshipPatterns: buildFamilyMetadata(userMessages.length, totalMessages, extractionMetadata, "private-only"),
  };
  const conversationId = options?.conversationId ? slugifyConversationId(options.conversationId) : "conversation";
  const conversationProfiles = [buildConversationProfile(messages, userName, conversationId)];
  const coverageSummary = buildCoverageSummary(
    conversationProfiles,
    totalMessages,
    userMessages.length,
    earliest,
    latest,
  );

  const signals: WhatsAppSignals = {
    avgResponseLatencyMs: avgLatencyMs,
    responseLatencyStdDevMs: stdDevLatencyMs,
    initiationRatio,
    avgMessageLength,
    longMessageRatio,
    emojiDensity,
    questionRatio,
    hourlyDistribution: hourlyDist,
    closeTieStabilityScore,
    activeHoursProfile,
    derivedCommunicationStyle,
    totalMessages,
    userMessageCount: userMessages.length,
    uniqueContacts,
    isLowConfidence: userMessages.length < LOW_CONFIDENCE_THRESHOLD,
    exportDateRange: { earliest, latest },
    analysedAt: new Date(),
    extractionMetadata,
    signalFamilyMetadata,
    shareableSummary: [],
    coverageSummary,
    conversationProfiles,
    globalProfile: {
      coverage: coverageSummary,
      shareableSummaryCandidates: [],
      privateOnlySignals: [],
    },
  };

  signals.shareableSummary = buildShareableSummary(signals);
  signals.globalProfile = buildGlobalProfile(
    coverageSummary,
    signals.shareableSummary,
    signals.closeTieStabilityScore,
  );

  return signals;
}
