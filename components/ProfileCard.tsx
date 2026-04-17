import { RomanticProfile } from "@/lib/types/matching";

type ProfileCardProps = {
  profile: RomanticProfile;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function ProfileCard({ profile, title, subtitle, compact = false }: ProfileCardProps) {
  return (
    <article className="rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-sm">
      {title ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">{title}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold text-zinc-900">{profile.name}, {profile.age}</h3>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
          {profile.agentType === "hosted" ? "Hosted Agent" : "External / Mock Agent"}
        </span>
      </div>
      {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      <p className="mt-3 text-sm leading-6 text-zinc-700">{profile.bio}</p>
      {!compact ? (
        <div className="mt-4 space-y-2 text-sm text-zinc-600">
          <p><span className="font-medium text-zinc-800">Intent:</span> {profile.relationshipIntent}</p>
          <p><span className="font-medium text-zinc-800">Values:</span> {profile.values.slice(0, 3).join(", ")}</p>
          <p><span className="font-medium text-zinc-800">Interests:</span> {profile.interests.slice(0, 3).join(", ")}</p>
          <p><span className="font-medium text-zinc-800">Location:</span> {profile.location}</p>
        </div>
      ) : null}
    </article>
  );
}
