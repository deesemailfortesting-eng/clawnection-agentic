import { Recommendation } from "@/lib/types/matching";

const palette = {
  meet: "bg-emerald-100 text-emerald-800 border-emerald-200",
  maybe: "bg-amber-100 text-amber-800 border-amber-200",
  "not-recommended": "bg-rose-100 text-rose-800 border-rose-200",
} as const;

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  const label =
    recommendation.verdict === "meet"
      ? "Recommend Meeting"
      : recommendation.verdict === "maybe"
        ? "Maybe — Human Review"
        : "Not Recommended";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${palette[recommendation.verdict]}`}>
      {label}
    </span>
  );
}
