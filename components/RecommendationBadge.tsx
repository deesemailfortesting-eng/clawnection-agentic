import { Recommendation } from "@/lib/types/matching";

const palette = {
  meet: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40",
  maybe: "bg-amber-500/15 text-amber-100 ring-amber-400/40",
  "not-recommended": "bg-rose-500/15 text-rose-100 ring-rose-400/40",
} as const;

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  const label =
    recommendation.verdict === "meet"
      ? "Recommendation: meet"
      : recommendation.verdict === "maybe"
        ? "Recommendation: proceed with care"
        : "Recommendation: not a fit for this simulation";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${palette[recommendation.verdict]}`}
    >
      {label}
    </span>
  );
}
