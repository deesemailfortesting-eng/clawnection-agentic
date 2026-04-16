import { MatchResult, RomanticProfile } from "@/lib/types/matching";

export const LOCAL_PROFILE_KEY = "clawnection.profile.v1";
export const LOCAL_RESULT_KEY = "clawnection.lastResult.v1";

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
