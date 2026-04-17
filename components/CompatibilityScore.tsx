type CompatibilityScoreProps = {
  score: number;
};

export function CompatibilityScore({ score }: CompatibilityScoreProps) {
  const hue = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Compatibility Score</p>
      <div className="mt-2 flex items-end gap-3">
        <p className="text-4xl font-semibold text-zinc-900">{score}</p>
        <p className="pb-1 text-sm text-zinc-500">/ 100</p>
      </div>
      <div className="mt-4 h-2.5 w-full rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${hue}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
