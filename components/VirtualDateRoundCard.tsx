import { VirtualDateRound } from "@/lib/types/matching";

const signalStyles = {
  positive: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35",
  mixed: "bg-amber-500/15 text-amber-100 ring-amber-400/35",
  caution: "bg-rose-500/15 text-rose-100 ring-rose-400/35",
} as const;

export function VirtualDateRoundCard({ round }: { round: VirtualDateRound }) {
  return (
    <article className="card-obsidian">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{round.title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${signalStyles[round.signal]}`}>
          {round.signal}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{round.summary}</p>
    </article>
  );
}
