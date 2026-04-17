import { VirtualDateRound } from "@/lib/types/matching";

const signalStyles = {
  positive: "bg-emerald-100 text-emerald-700",
  mixed: "bg-amber-100 text-amber-700",
  caution: "bg-rose-100 text-rose-700",
} as const;

export function VirtualDateRoundCard({ round }: { round: VirtualDateRound }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900">{round.title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${signalStyles[round.signal]}`}>
          {round.signal}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{round.summary}</p>
    </article>
  );
}
