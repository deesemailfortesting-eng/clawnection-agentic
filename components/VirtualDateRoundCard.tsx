import { VirtualDateRound } from "@/lib/types/matching";

const signalStyles = {
  positive: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
  mixed: "border-amber-300/30 bg-amber-400/15 text-amber-100",
  caution: "border-red-300/30 bg-red-400/15 text-red-100",
} as const;

export function VirtualDateRoundCard({ round }: { round: VirtualDateRound }) {
  return (
    <article className="obsidian-card rounded-[26px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-white">{round.title}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${signalStyles[round.signal]}`}>
          {round.signal}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/68">{round.summary}</p>
    </article>
  );
}
