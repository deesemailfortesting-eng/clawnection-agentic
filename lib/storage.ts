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
