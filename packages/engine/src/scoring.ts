import type { Game, ScoringConfig, ValidationIssue } from './types.ts';

export function validateScoringConfig(cfg: ScoringConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(cfg.pointsToWin) || cfg.pointsToWin < 1) {
    issues.push({
      code: 'scoring.points_to_win_invalid',
      severity: 'blocking',
      message: `Points to win must be a positive whole number (got ${cfg.pointsToWin}).`,
    });
  }
  if (![1, 3, 5].includes(cfg.bestOf)) {
    issues.push({
      code: 'scoring.best_of_invalid',
      severity: 'blocking',
      message: `Best of must be 1, 3, or 5 (got ${cfg.bestOf}).`,
    });
  }
  if (cfg.cap !== undefined && cfg.cap < cfg.pointsToWin) {
    issues.push({
      code: 'scoring.cap_below_points_to_win',
      severity: 'blocking',
      message: `Score cap (${cfg.cap}) cannot be below points to win (${cfg.pointsToWin}).`,
    });
  }
  return issues;
}

export function validateGameScore(cfg: ScoringConfig, game: Game): ValidationIssue[] {
  const { homeScore: h, awayScore: a, gameNumber } = game;

  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
    return [issue('scoring.negative_score', `Game ${gameNumber}: scores must be non-negative whole numbers.`)];
  }
  if (h === a) {
    return [issue('scoring.tied_score', `Game ${gameNumber}: a score of ${h}-${a} has no winner.`)];
  }

  const winner = Math.max(h, a);
  const loser = Math.min(h, a);
  const cap = cfg.cap;
  const cappedAtLimit = cap !== undefined && winner === cap;

  if (winner < cfg.pointsToWin) {
    return [issue(
      'scoring.winner_below_points_to_win',
      `Game ${gameNumber}: winning score ${winner} is below the ${cfg.pointsToWin} needed to win this stage.`,
    )];
  }
  if (cfg.winBy === 'win_by_two' && !cappedAtLimit && winner - loser < 2) {
    return [issue(
      'scoring.win_by_two_violated',
      `Game ${gameNumber}: this stage requires winning by 2; ${winner}-${loser} doesn't clear that margin.`,
    )];
  }
  if (cap !== undefined && winner > cap) {
    return [issue(
      'scoring.exceeds_cap',
      `Game ${gameNumber}: winning score ${winner} exceeds this stage's cap of ${cap}.`,
    )];
  }
  return [];

  function issue(code: string, message: string): ValidationIssue {
    return { code, severity: 'blocking', message };
  }
}

export function gameWinner(game: Game): 'home' | 'away' | null {
  if (game.homeScore === game.awayScore) return null;
  return game.homeScore > game.awayScore ? 'home' : 'away';
}

export function matchWinner(cfg: ScoringConfig, games: Game[]): 'home' | 'away' | null {
  const needed = Math.ceil(cfg.bestOf / 2);
  let homeWins = 0;
  let awayWins = 0;
  for (const g of games) {
    const w = gameWinner(g);
    if (w === 'home') homeWins++;
    else if (w === 'away') awayWins++;
  }
  if (homeWins >= needed) return 'home';
  if (awayWins >= needed) return 'away';
  return null;
}
