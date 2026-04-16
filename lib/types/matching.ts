export type AgentType = "hosted" | "external-mock";

export type RelationshipIntent =
  | "long-term"
  | "serious-dating"
  | "exploring"
  | "friendship-first";

export type CommunicationStyle =
  | "direct"
  | "warm"
  | "playful"
  | "reflective"
  | "balanced";

export type LifestyleHabits = {
  sleepSchedule: "early-bird" | "night-owl" | "flexible";
  socialEnergy: "low-key" | "balanced" | "high-energy";
  activityLevel: "relaxed" | "active" | "very-active";
  drinking: "never" | "social" | "regular";
  smoking: "never" | "occasionally" | "regular";
};

export type RomanticProfile = {
  id: string;
  name: string;
  age: number;
  genderIdentity: string;
  lookingFor: string;
  location: string;
  relationshipIntent: RelationshipIntent;
  bio: string;
  interests: string[];
  values: string[];
  communicationStyle: CommunicationStyle;
  lifestyleHabits: LifestyleHabits;
  dealbreakers: string[];
  idealFirstDate: string;
  preferenceAgeRange: {
    min: number;
    max: number;
  };
  preferenceNotes: string;
  agentType: AgentType;
};

export type VirtualDateRoundType =
  | "introductions"
  | "intentions"
  | "lifestyle"
  | "values"
  | "communication"
  | "fun-chemistry";

export type VirtualDateRound = {
  round: number;
  type: VirtualDateRoundType;
  title: string;
  summary: string;
  signal: "positive" | "mixed" | "caution";
};

export type Concern = {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

export type FirstDateSuggestion = {
  idea: string;
  whyItFits: string;
  logisticsNote: string;
};

export type Recommendation = {
  verdict: "meet" | "maybe" | "not-recommended";
  rationale: string;
  humanDecisionReminder: string;
};

export type MatchResult = {
  profileA: RomanticProfile;
  profileB: RomanticProfile;
  compatibilityScore: number;
  strengths: string[];
  concerns: Concern[];
  rounds: VirtualDateRound[];
  firstDateSuggestion: FirstDateSuggestion;
  closingAssessment: string;
  recommendation: Recommendation;
};
