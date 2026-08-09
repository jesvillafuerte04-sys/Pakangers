import type {
  Advancement,
  Entrant,
  PlannedMatch,
  StageConfig,
  Standing,
  TournamentFormat,
  ValidationIssue,
} from '../types.ts';
import { computeStandings } from '../standings.ts';
import { validateScoringConfig } from '../scoring.ts';

const BYE = '__bye__';

/** Circle method: fix one entrant, rotate the rest. n-1 rounds, n/2 matches per round. */
function circleMethodRounds(ids: string[]): [string, string][][] {
  const list = ids.length % 2 === 0 ? [...ids] : [...ids, BYE];
  const n = list.length;
  const fixed = list[0]!;
  let rotating = list.slice(1);
  const rounds: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const roundList = [fixed, ...rotating];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([roundList[i]!, roundList[n - 1 - i]!]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }
  return rounds;
}

function stageGroups(cfg: StageConfig, entrants: Entrant[]): { name: string; entrantIds: string[] }[] {
  return cfg.groups ?? [{ name: cfg.key, entrantIds: entrants.map((e) => e.id) }];
}

export const roundRobinFormat: TournamentFormat = {
  key: 'round_robin',

  validate(cfg, entrants) {
    const issues: ValidationIssue[] = [...validateScoringConfig(cfg.scoring)];
    for (const g of stageGroups(cfg, entrants)) {
      if (g.entrantIds.length < 2) {
        issues.push({
          code: 'round_robin.group_too_small',
          severity: 'blocking',
          message: `Group "${g.name}" has ${g.entrantIds.length} team(s) — round robin needs at least 2.`,
        });
      }
    }
    return issues;
  },

  generateMatches(cfg, entrants) {
    const planned: PlannedMatch[] = [];
    let matchNumber = 1;
    for (const g of stageGroups(cfg, entrants)) {
      const rounds = circleMethodRounds(g.entrantIds);
      rounds.forEach((pairs, roundIdx) => {
        for (const [a, b] of pairs) {
          if (a === BYE || b === BYE) continue;
          planned.push({
            matchNumber: matchNumber++,
            round: roundIdx + 1,
            group: g.name,
            home: { kind: 'entrant', entrantId: a },
            away: { kind: 'entrant', entrantId: b },
          });
        }
      });
    }
    return planned;
  },

  computeStandings(cfg, entrants, matches) {
    const all: Standing[] = [];
    for (const g of stageGroups(cfg, entrants)) {
      const groupMatches = matches.filter((m) => m.group === g.name);
      all.push(...computeStandings(g.entrantIds, groupMatches, cfg.tiebreakers));
    }
    return all;
  },

  resolveAdvancement(cfg, entrants, matches) {
    const advancement: Advancement[] = [];
    for (const g of stageGroups(cfg, entrants)) {
      const groupMatches = matches.filter((m) => m.group === g.name);
      const standings = computeStandings(g.entrantIds, groupMatches, cfg.tiebreakers);
      for (const s of standings) {
        advancement.push({ fromGroup: g.name, entrantId: s.entrantId, rank: s.rank });
      }
    }
    return advancement;
  },
};
