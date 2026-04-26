import { RomanticProfile } from "@/lib/types/matching";

type ProfileCardProps = {
  profile: RomanticProfile;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function ProfileCard({ profile, title, subtitle, compact = false }: ProfileCardProps) {
  return (
    <article className="card-obsidian border-[var(--border-strong)]/60">
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{title}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {profile.name}, {profile.age}
        </h3>
        <span className="rounded-full bg-[var(--surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">
          {profile.agentType === "hosted" ? "Hosted agent" : "External mock agent"}
        </span>
      </div>
      {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{profile.bio}</p>
      {!compact ? (
        <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
          <p>
            <span className="font-medium text-[var(--text-primary)]">Intent:</span> {profile.relationshipIntent}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">Values:</span>{" "}
            {profile.values.slice(0, 3).join(", ") || "—"}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">Interests:</span>{" "}
            {profile.interests.slice(0, 3).join(", ") || "—"}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">Location:</span> {profile.location}
          </p>
        </div>
      ) : null}
    </article>
  );
}
