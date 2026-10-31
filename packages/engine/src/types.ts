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
  /**
   * Head-to-head result, consulted only when exactly two entrants are level.
   * A tie of three or more skips it and falls through to the next criterion.
   */
  | 'head_to_head_two_way'
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
 *  6. coin_flip                       decided by coin toss; flagged, never guessed
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

/**
 * The Pakangers round-robin tie-break order, used for every official event.
 *
 *  1. match_wins            most matches won
 *  2. head_to_head_two_way  two teams level: the winner of their match
 *  3. point_differential    three or more level: overall margin in the bracket
 *  4. points_scored         then total points earned
 *  5. coin_flip             then a coin toss; flagged, never guessed
 *
 * The list is re-applied from the top whenever a tie splits, so a three-way
 * tie that point differential narrows to two is then settled head-to-head.
 */
export const PAKANGERS_TIEBREAKERS: Tiebreaker[] = [
  'match_wins',
  'head_to_head_two_way',
  'point_differential',
  'points_scored',
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

/**
 * Which tiebreaker separated one entrant from the one directly above it, and
 * the two values that criterion compared.
 *
 * Recorded by the engine as it ranks, rather than reconstructed afterwards:
 * an explanation worked out separately from the decision will eventually
 * disagree with it, and a standing that explains itself wrongly is worse than
 * one that says nothing.
 */
export type SeparationReason = {
  tiebreaker: Tiebreaker;
  /** This entrant's value for that criterion. */
  value: number;
  /** The value of the entrant immediately above. */
  aboveValue: number;
  /** How many entrants were still level when this criterion was applied. */
  tiedCount: number;
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
  /** Null for the top entrant of a bracket, and whenever nothing was tied. */
  separatedFromAbove?: SeparationReason | null;
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
