import type { TeamDisplay } from "@/lib/team-display";

export function TeamLine({
  display,
  className = "",
  variant = "dark",
}: {
  display: TeamDisplay;
  className?: string;
  variant?: "dark" | "light";
}) {
  const headerColor = variant === "light" ? "text-[var(--color-cream)]" : "text-[var(--color-navy)]";
  const subtextColor = variant === "light" ? "text-[var(--color-cream-dark)]" : "text-[var(--color-text-muted)]";
  return (
    <div className={className}>
      <div className={`font-medium ${headerColor}`}>{display.header}</div>
      {display.subtext && <div className={`text-xs ${subtextColor} opacity-70`}>{display.subtext}</div>}
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
