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
  | 'head_to_head'
  | 'point_differential'
  | 'points_scored'
  | 'points_allowed'
  | 'games_won'
  | 'coin_flip';

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
