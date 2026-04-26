import { Recommendation } from "@/lib/types/matching";

const palette = {
  meet: "bg-emerald-400/14 text-emerald-100 border-emerald-300/32",
  maybe: "bg-amber-400/14 text-amber-100 border-amber-300/32",
  "not-recommended": "bg-red-400/14 text-red-100 border-red-300/32",
} as const;

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  const label =
    recommendation.verdict === "meet"
      ? "Recommend Meeting"
      : recommendation.verdict === "maybe"
        ? "Maybe — Human Review"
        : "Not Recommended";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-black ${palette[recommendation.verdict]}`}>
      {label}
    </span>
  );
}
