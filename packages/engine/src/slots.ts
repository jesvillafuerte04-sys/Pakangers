import type { Match, MatchStatus, SlotRef, Standing } from './types.ts';
import { matchWinner } from './scoring.ts';

const RESOLVED_STATUSES: MatchStatus[] = ['completed', 'forfeit', 'bye'];

export type ResolutionContext = {
  /** Standings for the group a `group_rank` ref points at, keyed by group name. */
  standingsByGroup: Map<string, Standing[]>;
  /** Completed matches a `match_outcome` ref points at, keyed by "stageKey:matchNumber". */
  matchesByStageAndNumber: Map<string, Match>;
};

/**
 * Resolves a slot reference to a concrete entrant id, or null if the source
 * it depends on (a group's standings, or another match) isn't resolved yet.
 */
export function resolveSlotRef(ref: SlotRef, ctx: ResolutionContext): string | null {
  if (ref.kind === 'group_rank') {
    const standings = ctx.standingsByGroup.get(ref.group);
    if (!standings) return null;
    return standings.find((s) => s.rank === ref.rank)?.entrantId ?? null;
  }

  const match = ctx.matchesByStageAndNumber.get(`${ref.stage}:${ref.match}`);
  if (!match || !RESOLVED_STATUSES.includes(match.status)) return null;

  if (match.status === 'bye') {
    // A bye has only a winner; there's nothing to reference as its loser.
    const present = match.homeEntrantId ?? match.awayEntrantId;
    return ref.outcome === 'winner' ? present : null;
  }
  if (!match.homeEntrantId || !match.awayEntrantId) return null;

  const winnerSide = matchWinner(match.scoringConfig, match.games);
  if (!winnerSide) return null;
  const winnerId = winnerSide === 'home' ? match.homeEntrantId : match.awayEntrantId;
  const loserId = winnerSide === 'home' ? match.awayEntrantId : match.homeEntrantId;
  return ref.outcome === 'winner' ? winnerId : loserId;
}
