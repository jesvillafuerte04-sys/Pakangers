import type { TeamDisplay, PlayerDisplayInfo } from "@/lib/team-display";
import { TeamAvatarGroup } from "./PlayerAvatar";

/**
 * The minimum a match needs to render as a card. Both MatchListRow and the
 * bracket's PublicBracketMatch satisfy this, so the match list and the bracket
 * share one visual treatment.
 */
export type MatchCardData = {
  home: TeamDisplay;
  away: TeamDisplay;
  homePointsTotal: number | null;
  awayPointsTotal: number | null;
  winnerSide: "home" | "away" | null;
  resultType: string | null;
};

/**
 * One side of a match: player names (and optional team name) on the left, that
 * side's score hard-right. Once a result exists the winner stays full-strength
 * and the loser fades, so a completed match reads at a glance.
 */
function MatchSide({
  header,
  subtext,
  players,
  score,
  outcome,
}: {
  header: string;
  subtext: string | null;
  players?: PlayerDisplayInfo[];
  score: number | null;
  outcome: "won" | "lost" | "undecided";
}) {
  const nameColor = outcome === "lost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-navy)]";
  const nameWeight = outcome === "won" ? "font-bold" : "font-medium";
  const scoreColor = outcome === "lost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-navy)]";

  return (
    <div className={`flex items-center justify-between gap-3 ${outcome === "lost" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {players && players.length > 0 && (
          <TeamAvatarGroup players={players} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className={`${nameWeight} ${nameColor} leading-tight truncate`}>{header}</div>
          {subtext && <div className="text-xs text-[var(--color-text-muted)] opacity-80 truncate">{subtext}</div>}
        </div>
      </div>
      {score !== null && (
        <span className={`flex-none text-2xl leading-none tabular-nums ${nameWeight} ${scoreColor}`}>{score}</span>
      )}
    </div>
  );
}

export function MatchCardBody({ match }: { match: MatchCardData }) {
  const decided = match.winnerSide !== null;
  const homeOutcome = decided ? (match.winnerSide === "home" ? "won" : "lost") : "undecided";
  const awayOutcome = decided ? (match.winnerSide === "away" ? "won" : "lost") : "undecided";

  return (
    <div className="flex flex-col gap-2.5">
      <MatchSide
        header={match.home.header}
        subtext={match.home.subtext}
        players={match.home.players}
        score={match.homePointsTotal}
        outcome={homeOutcome}
      />
      <MatchSide
        header={match.away.header}
        subtext={match.away.subtext}
        players={match.away.players}
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
