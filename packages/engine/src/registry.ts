import type { TournamentFormat } from './types.ts';
import { roundRobinFormat } from './formats/round_robin.ts';
import { singleEliminationFormat } from './formats/single_elimination.ts';

const registry = new Map<string, TournamentFormat>([
  [roundRobinFormat.key, roundRobinFormat],
  [singleEliminationFormat.key, singleEliminationFormat],
]);

/** Adding a new tournament format (double elimination, Swiss, ...) means calling this once — never editing the engine. */
export function registerFormat(format: TournamentFormat): void {
  registry.set(format.key, format);
}

export function getFormat(key: string): TournamentFormat {
  const format = registry.get(key);
  if (!format) throw new Error(`Unknown tournament format: "${key}"`);
  return format;
}
