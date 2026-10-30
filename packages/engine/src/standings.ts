import type { Match, Standing, Tiebreaker } from './types.ts';
import { gameWinner, matchWinner } from './scoring.ts';

type Row = {
  entrantId: string;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
};

/**
 * Computes standings for a set of entrants over a set of matches, ranked by an
 * ordered list of tiebreakers. Pure: never stored, always derived on read.
 */
export function computeStandings(entrantIds: string[], matches: Match[], tiebreakers: Tiebreaker[]): Standing[] {
  const rows = new Map<string, Row>();
  for (const id of entrantIds) {
    rows.set(id, { entrantId: id, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  const resolved = matches.filter((m) => m.status === 'completed' || m.status === 'forfeit' || m.status === 'bye');
  for (const m of resolved) {
    if (m.status === 'bye') {
      // A bye is an automatic win for whichever side is present, with no points to record.
      const presentId = m.homeEntrantId ?? m.awayEntrantId;
      const row = presentId ? rows.get(presentId) : undefined;
      if (row) row.wins++;
      continue;
    }
    if (!m.homeEntrantId || !m.awayEntrantId) continue;
    const home = rows.get(m.homeEntrantId);
    const away = rows.get(m.awayEntrantId);
    if (!home || !away) continue;

    for (const g of m.games) {
      home.pointsFor += g.homeScore;
      home.pointsAgainst += g.awayScore;
      away.pointsFor += g.awayScore;
      away.pointsAgainst += g.homeScore;
      const gw = gameWinner(g);
      if (gw === 'home') { home.gamesWon++; away.gamesLost++; }
      else if (gw === 'away') { away.gamesWon++; home.gamesLost++; }
    }

    const winner = matchWinner(m.scoringConfig, m.games);
    if (winner === 'home') { home.wins++; away.losses++; }
    else if (winner === 'away') { away.wins++; home.losses++; }
  }

  const base: Standing[] = [...rows.values()].map((r) => ({
    entrantId: r.entrantId,
    rank: 0,
    wins: r.wins,
    losses: r.losses,
    gamesWon: r.gamesWon,
    gamesLost: r.gamesLost,
    pointsFor: r.pointsFor,
    pointsAgainst: r.pointsAgainst,
    pointDifferential: r.pointsFor - r.pointsAgainst,
    winPercentage: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
    unresolvedTie: false,
  }));

  return rankByTiebreakers(base, resolved, tiebreakers);
}

function metricValue(s: Standing, tb: Tiebreaker): number {
  switch (tb) {
    case 'match_wins': return s.wins;
    case 'win_percentage': return s.winPercentage;
    case 'point_differential': return s.pointDifferential;
    case 'points_scored': return s.pointsFor;
    case 'points_allowed': return -s.pointsAgainst; // fewer allowed is better
    case 'games_won': return s.gamesWon;
    case 'coin_flip': return 0; // the engine can't toss a coin — always inconclusive, flagged for a real toss
    default: return 0;
  }
}

/** Point differential counted only in matches played between the tied entrants. */
function headToHeadPointDiff(ids: string[], matches: Match[]): Map<string, number> {
  const diff = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const m of matches) {
    if (!m.homeEntrantId || !m.awayEntrantId) continue;
    if (!ids.includes(m.homeEntrantId) || !ids.includes(m.awayEntrantId)) continue;
    for (const g of m.games) {
      diff.set(m.homeEntrantId, (diff.get(m.homeEntrantId) ?? 0) + (g.homeScore - g.awayScore));
      diff.set(m.awayEntrantId, (diff.get(m.awayEntrantId) ?? 0) + (g.awayScore - g.homeScore));
    }
  }
  return diff;
}

function headToHeadWins(ids: string[], matches: Match[]): Map<string, number> {
  const wins = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const m of matches) {
    if (!m.homeEntrantId || !m.awayEntrantId) continue;
    if (!ids.includes(m.homeEntrantId) || !ids.includes(m.awayEntrantId)) continue;
    const w = matchWinner(m.scoringConfig, m.games);
    if (w === 'home') wins.set(m.homeEntrantId, (wins.get(m.homeEntrantId) ?? 0) + 1);
    else if (w === 'away') wins.set(m.awayEntrantId, (wins.get(m.awayEntrantId) ?? 0) + 1);
  }
  return wins;
}

/** Splits a tied group into ordered sub-groups by a numeric key, higher first. */
function partitionByKey(group: Standing[], keyOf: (s: Standing) => number): Standing[][] {
  const sorted = [...group].sort((a, b) => keyOf(b) - keyOf(a));
  const out: Standing[][] = [];
  let i = 0;
  while (i < sorted.length) {
    const v = keyOf(sorted[i]!);
    let j = i;
    while (j < sorted.length && keyOf(sorted[j]!) === v) j++;
    out.push(sorted.slice(i, j));
    i = j;
  }
  return out;
}

/**
 * Applies one tiebreaker to a tied group, returning ordered sub-groups.
 * A single returned group means this tiebreaker could not separate anyone.
 */
function applyTiebreaker(group: Standing[], matches: Match[], tb: Tiebreaker): Standing[][] {
  if (tb === 'head_to_head' || tb === 'head_to_head_point_differential') {
    // Both are computed over the matches played *between the tied entrants only*,
    // which is what USA Pickleball calls for. With 3+ tied entrants this is the
    // mini round robin among them.
    const ids = group.map((s) => s.entrantId);
    const metric =
      tb === 'head_to_head' ? headToHeadWins(ids, matches) : headToHeadPointDiff(ids, matches);
    const distinct = new Set(ids.map((id) => metric.get(id) ?? 0));
    // Circular or identical within this subset -- cannot separate, hand the group on untouched.
    if (distinct.size <= 1) return [group];
    return partitionByKey(group, (s) => metric.get(s.entrantId) ?? 0);
  }
  return partitionByKey(group, (s) => metricValue(s, tb));
}

/**
 * Ranks one tied group by walking the tiebreaker list in order.
 *
 * When a tiebreaker splits the group, each resulting sub-group is ranked by
 * starting the list again from the top. That re-application is deliberate: USA
 * Pickleball requires that once a three-way tie collapses to a two-way tie, the
 * head-to-head result between those two is consulted again rather than skipped.
 */
function rankGroup(group: Standing[], matches: Match[], tiebreakers: Tiebreaker[]): Standing[] {
  if (group.length <= 1) return group;

  for (const tb of tiebreakers) {
    const parts = applyTiebreaker(group, matches, tb);
    if (parts.length > 1) {
      return parts.flatMap((part) => rankGroup(part, matches, tiebreakers));
    }
  }

  // Every tiebreaker exhausted and these entrants are still level: flag for the
  // organizer to settle (coin toss) and order them stably so the list never jumps.
  const stable = [...group].sort((a, b) => a.entrantId.localeCompare(b.entrantId));
  for (const s of stable) s.unresolvedTie = true;
  return stable;
}

function rankByTiebreakers(standings: Standing[], matches: Match[], tiebreakers: Tiebreaker[]): Standing[] {
  const finalOrder = rankGroup([...standings], matches, tiebreakers);
  finalOrder.forEach((s, idx) => { s.rank = idx + 1; });
  return finalOrder;
}
