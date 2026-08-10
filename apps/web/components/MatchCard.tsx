import type { MatchListRow } from "@/lib/match-data";

/**
 * One side of a match: player names (and optional team name) on the left, that
 * side's score hard-right. Once a result exists the winner stays full-strength
 * and the loser fades, so a completed match reads at a glance.
 */
function MatchSide({
  header,
  subtext,
  score,
  outcome,
}: {
  header: string;
  subtext: string | null;
  score: number | null;
  outcome: "won" | "lost" | "undecided";
}) {
  const nameColor = outcome === "lost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-navy)]";
  const nameWeight = outcome === "won" ? "font-bold" : "font-medium";
  const scoreColor = outcome === "lost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-navy)]";

  return (
    <div className={`flex items-baseline justify-between gap-3 ${outcome === "lost" ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className={`${nameWeight} ${nameColor} leading-tight`}>{header}</div>
        {subtext && <div className="text-xs text-[var(--color-text-muted)] opacity-80">{subtext}</div>}
      </div>
      {score !== null && (
        <span className={`flex-none text-2xl leading-none tabular-nums ${nameWeight} ${scoreColor}`}>{score}</span>
      )}
    </div>
  );
}

export function MatchCardBody({ match }: { match: MatchListRow }) {
  const decided = match.winnerSide !== null;
  const homeOutcome = decided ? (match.winnerSide === "home" ? "won" : "lost") : "undecided";
  const awayOutcome = decided ? (match.winnerSide === "away" ? "won" : "lost") : "undecided";

  return (
    <div className="flex flex-col gap-2">
      <MatchSide
        header={match.home.header}
        subtext={match.home.subtext}
        score={match.homePointsTotal}
        outcome={homeOutcome}
      />
      <MatchSide
        header={match.away.header}
        subtext={match.away.subtext}
        score={match.awayPointsTotal}
        outcome={awayOutcome}
      />
      {match.resultType && match.resultType !== "normal" && (
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {match.resultType}
        </span>
      )}
    </div>
  );
}
