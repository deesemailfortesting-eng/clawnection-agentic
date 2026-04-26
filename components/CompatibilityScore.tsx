type CompatibilityScoreProps = {
  score: number;
  /** Plain-language explanation of what the bar and number convey */
  narration: string;
};

export function CompatibilityScore({ score, narration }: CompatibilityScoreProps) {
  const hue =
    score >= 75 ? "bg-emerald-400" : score >= 55 ? "bg-amber-400" : "bg-[var(--accent)]";

  return (
    <div className="card-obsidian">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Compatibility score</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{narration}</p>
      <div className="mt-4 flex items-end gap-3">
        <p className="text-4xl font-semibold tabular-nums text-[var(--text-primary)]">{score}</p>
        <p className="pb-1 text-sm text-[var(--text-muted)]">out of 100</p>
      </div>
      <div
        className="mt-4 h-2.5 w-full rounded-full bg-[var(--surface-elevated)]"
        role="img"
        aria-label={`Compatibility score ${score} out of 100`}
      >
        <div className={`h-full rounded-full ${hue}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}
