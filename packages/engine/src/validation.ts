import type { ValidationIssue } from './types.ts';
import type { QualificationRule } from './qualification.ts';

export type Player = { id: string; name: string };
export type Team = { id: string; name: string; memberIds: string[]; expectedSize: number };

/**
 * Checks player/team assignment invariants: no player on two teams, every team
 * has the right number of players, no team left empty, every player accounted for.
 */
export function validateTeams(players: Player[], teams: Team[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const teamsByPlayer = new Map<string, string[]>();

  for (const t of teams) {
    for (const pid of t.memberIds) {
      const list = teamsByPlayer.get(pid) ?? [];
      list.push(t.id);
      teamsByPlayer.set(pid, list);
    }
    if (t.memberIds.length === 0) {
      issues.push({
        code: 'team.no_players',
        severity: 'blocking',
        message: `Team "${t.name}" has no players assigned.`,
        entityRef: { type: 'team', id: t.id },
      });
    } else if (t.memberIds.length !== t.expectedSize) {
      issues.push({
        code: 'team.wrong_size',
        severity: 'blocking',
        message: `Team "${t.name}" has ${t.memberIds.length} player(s), expected ${t.expectedSize}.`,
        entityRef: { type: 'team', id: t.id },
      });
    }
  }

  for (const [pid, teamIds] of teamsByPlayer) {
    if (teamIds.length > 1) {
      const player = players.find((p) => p.id === pid);
      issues.push({
        code: 'player.on_multiple_teams',
        severity: 'blocking',
        message: `${player ? player.name : pid} is assigned to ${teamIds.length} teams.`,
        entityRef: { type: 'player', id: pid },
      });
    }
  }

  const assigned = new Set(teamsByPlayer.keys());
  for (const p of players) {
    if (!assigned.has(p.id)) {
      issues.push({
        code: 'player.unassigned',
        severity: 'warning',
        message: `${p.name} is registered but not assigned to any team.`,
        entityRef: { type: 'player', id: p.id },
      });
    }
  }

  return issues;
}

/** Checks that a qualification rule doesn't ask for more qualifiers than the source group has. */
export function validateQualificationRule(rule: QualificationRule, sourceGroupSize: number): ValidationIssue[] {
  if (rule.method === 'top_n' && rule.value > sourceGroupSize) {
    return [{
      code: 'qualification.exceeds_group_size',
      severity: 'blocking',
      message: `Qualification asks for top ${rule.value}, but the source group only has ${sourceGroupSize} teams.`,
    }];
  }
  return [];
}
