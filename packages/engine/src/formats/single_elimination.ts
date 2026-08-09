import type {
  Entrant,
  MatchSide,
  PlannedMatch,
  TournamentFormat,
  ValidationIssue,
} from '../types.ts';
import { computeStandings } from '../standings.ts';
import { validateScoringConfig } from '../scoring.ts';

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

/** Standard bracket seeding order, e.g. size 8 -> [1,8,4,5,2,7,3,6]. Keeps top seeds apart the longest. */
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const s = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, s + 1 - seed);
    }
    order = next;
  }
  return order;
}

export const singleEliminationFormat: TournamentFormat = {
  key: 'single_elimination',

  validate(cfg, entrants) {
    const issues: ValidationIssue[] = [...validateScoringConfig(cfg.scoring)];
    if (cfg.entrants) return issues; // explicit slot-wired stage — structure is defined by config, not entrant count
    if (entrants.length < 2) {
      issues.push({
        code: 'single_elimination.too_few_entrants',
        severity: 'blocking',
        message: `Single elimination needs at least 2 entrants (got ${entrants.length}).`,
      });
    }
    return issues;
  },

  generateMatches(cfg, entrants) {
    if (cfg.entrants) {
      return cfg.entrants.map((e) => ({
        matchNumber: e.match,
        round: 1,
        home: e.home,
        away: e.away,
      }));
    }

    const seeded = [...entrants].sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity));
    const size = nextPowerOfTwo(seeded.length);
    const order = seedOrder(size);
    const bySeed = new Map<number, Entrant>();
    seeded.forEach((e, i) => bySeed.set(i + 1, e));

    const planned: PlannedMatch[] = [];
    let matchNumber = 1;
    const round1Count = size / 2;

    for (let i = 0; i < round1Count; i++) {
      const a = bySeed.get(order[i * 2]!);
      const b = bySeed.get(order[i * 2 + 1]!);
      const home: MatchSide = a ? { kind: 'entrant', entrantId: a.id } : { kind: 'bye' };
      const away: MatchSide = b ? { kind: 'entrant', entrantId: b.id } : { kind: 'bye' };
      planned.push({ matchNumber: matchNumber++, round: 1, home, away });
    }

    let round = 2;
    let prevRoundStart = 1;
    let prevRoundCount = round1Count;
    while (prevRoundCount > 1) {
      const thisRoundCount = prevRoundCount / 2;
      for (let i = 0; i < thisRoundCount; i++) {
        planned.push({
          matchNumber: matchNumber++,
          round,
          home: { kind: 'match_outcome', stage: cfg.key, match: prevRoundStart + i * 2, outcome: 'winner' },
          away: { kind: 'match_outcome', stage: cfg.key, match: prevRoundStart + i * 2 + 1, outcome: 'winner' },
        });
      }
      prevRoundStart += prevRoundCount;
      prevRoundCount = thisRoundCount;
      round++;
    }

    return planned;
  },

  computeStandings(cfg, entrants, matches) {
    return computeStandings(entrants.map((e) => e.id), matches, cfg.tiebreakers);
  },

  resolveAdvancement(cfg, entrants, matches) {
    const ids = entrants.map((e) => e.id);
    const standings = computeStandings(ids, matches, cfg.tiebreakers);
    return standings.map((s) => ({ entrantId: s.entrantId, rank: s.rank }));
  },
};
