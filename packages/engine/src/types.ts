export type ScoringConfig = {
  pointsToWin: number;
  winBy: 'win_by_two' | 'sudden_death';
  cap?: number;
  bestOf: 1 | 3 | 5;
  scoringType: 'side_out' | 'rally';
};

export type Tiebreaker =
  | 'match_wins'
  | 'win_percentage'
  /** Wins counted only in matches between the tied entrants (USA Pickleball step 1). */
  | 'head_to_head'
  /** Point differential counted only in matches between the tied entrants (USA Pickleball step 2). */
  | 'head_to_head_point_differential'
  | 'point_differential'
  | 'points_scored'
  | 'points_allowed'
  | 'games_won'
  | 'coin_flip';

/**
 * The USA Pickleball round-robin tie-break order, in one place so every
 * template, stage and test uses the same list.
 *
 *  1. match_wins                      most matches won
 *  2. head_to_head                    wins counted only between the tied teams
 *  3. head_to_head_point_differential the margin in those same matches
 *  4. point_differential              overall margin across the whole bracket
 *  5. points_allowed                  fewest points conceded
 *  6. coin_flip                       organizer decides; flagged, never guessed
 *
 * points_scored is deliberately absent: ranking on points scored rewards
 * running up the score, which USA Pickleball does not do.
 */
export const USAPA_TIEBREAKERS: Tiebreaker[] = [
  'match_wins',
  'head_to_head',
  'head_to_head_point_differential',
  'point_differential',
  'points_allowed',
  'coin_flip',
];

export type Entrant = {
  id: string;
  name: string;
  seed?: number;
};

/** A reference to where a stage's entrant comes from — never a literal team. */
export type SlotRef =
  | { kind: 'group_rank'; group: string; rank: number }
  | { kind: 'match_outcome'; stage: string; match: number; outcome: 'winner' | 'loser' };

export type PlannedMatchEntrants = {
  match: number;
  home: SlotRef;
  away: SlotRef;
};

export type StageConfig = {
  key: string;
  name: string;
  formatKey: string;
  scoring: ScoringConfig;
  tiebreakers: Tiebreaker[];
  /** Only present for pool/group stages generated directly from a roster. */
  groups?: { name: string; entrantIds: string[] }[];
  /** Only present for stages wired from other stages' outcomes. */
  entrants?: PlannedMatchEntrants[];
};

export type MatchSide =
  | SlotRef
  | { kind: 'entrant'; entrantId: string }
  | { kind: 'bye' };

export type PlannedMatch = {
  matchNumber: number;
  round: number;
  group?: string;
  home: MatchSide;
  away: MatchSide;
};

export type Game = {
  gameNumber: number;
  homeScore: number;
  awayScore: number;
};

/**
 * The score recorded when a match is awarded rather than played out -- a
 * forfeit, a default (no-show) or a retirement.
 *
 * Pakangers records these as 6-0 rather than 11-0 or 15-0. The winner still
 * gets a clear win and a real point differential for the standings, without
 * the inflated margin that a full walkover score would hand them over teams
 * that actually had to play.
 */
export const AWARDED_MATCH_SCORE = { winner: 6, loser: 0 } as const;

export type MatchStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'forfeit' | 'bye';

export type Match = {
  matchNumber: number;
  round: number;
  group?: string;
  homeEntrantId: string | null;
  awayEntrantId: string | null;
  status: MatchStatus;
  games: Game[];
  scoringConfig: ScoringConfig;
  source: 'generated' | 'manual';
};

export type Standing = {
  entrantId: string;
  rank: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  winPercentage: number;
  /** True when this team's rank could not be fully resolved by the configured tiebreakers. */
  unresolvedTie: boolean;
};

export type Advancement = {
  fromGroup?: string;
  entrantId: string;
  rank: number;
};

export type ValidationIssue = {
  code: string;
  severity: 'blocking' | 'warning';
  message: string;
  suggestedFix?: string;
  entityRef?: { type: string; id: string };
};

export interface TournamentFormat {
  key: string;
  validate(cfg: StageConfig, entrants: Entrant[]): ValidationIssue[];
  generateMatches(cfg: StageConfig, entrants: Entrant[]): PlannedMatch[];
  computeStandings(cfg: StageConfig, entrants: Entrant[], matches: Match[]): Standing[];
  resolveAdvancement(cfg: StageConfig, entrants: Entrant[], matches: Match[]): Advancement[];
}
