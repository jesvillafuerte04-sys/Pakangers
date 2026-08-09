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
    case 'coin_flip': return 0; // engine can't flip a coin — always inconclusive, left for the organizer
    default: return 0;
  }
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

function rankByTiebreakers(standings: Standing[], matches: Match[], tiebreakers: Tiebreaker[]): Standing[] {
  let groups: Standing[][] = [[...standings]];

  for (const tb of tiebreakers) {
    const nextGroups: Standing[][] = [];
    for (const group of groups) {
      if (group.length <= 1) { nextGroups.push(group); continue; }

      if (tb === 'head_to_head') {
        const ids = group.map((s) => s.entrantId);
        const h2h = headToHeadWins(ids, matches);
        const distinctValues = new Set(ids.map((id) => h2h.get(id) ?? 0));
        if (distinctValues.size <= 1) {
          // Circular or fully-tied within this subset — head-to-head can't separate them.
          nextGroups.push(group);
          continue;
        }
        nextGroups.push(...partitionByKey(group, (s) => h2h.get(s.entrantId) ?? 0));
      } else {
        nextGroups.push(...partitionByKey(group, (s) => metricValue(s, tb)));
      }
    }
    groups = nextGroups;
  }

  const finalOrder: Standing[] = [];
  for (const group of groups) {
    if (group.length > 1) {
      const stable = [...group].sort((a, b) => a.entrantId.localeCompare(b.entrantId));
      for (const s of stable) s.unresolvedTie = true;
      finalOrder.push(...stable);
    } else {
      finalOrder.push(...group);
    }
  }

  finalOrder.forEach((s, idx) => { s.rank = idx + 1; });
  return finalOrder;
}
