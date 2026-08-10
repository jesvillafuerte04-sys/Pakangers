import type { TeamDisplay } from "@/lib/team-display";

export function TeamLine({ display, className = "" }: { display: TeamDisplay; className?: string }) {
  return (
    <div className={className}>
      <div className="font-medium text-[var(--color-navy)]">{display.header}</div>
      {display.subtext && <div className="text-xs text-[var(--color-text-muted)]">{display.subtext}</div>}
    </div>
  );
}

export function TeamMatchup({ home, away }: { home: TeamDisplay; away: TeamDisplay }) {
  return (
    <div className="flex flex-col gap-1">
      <TeamLine display={home} />
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">vs</div>
      <TeamLine display={away} />
    </div>
  );
}
