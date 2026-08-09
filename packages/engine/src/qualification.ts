import type { Standing } from './types.ts';

export type QualificationMethod = 'top_n' | 'top_percent' | 'threshold';

export type QualificationRule = {
  method: QualificationMethod;
  /** top_n: count. top_percent: 0-100. threshold: minimum wins required. */
  value: number;
  fromGroup?: string;
};

/** Applies a qualification rule to one group's (or stage's) already-ranked standings. */
export function resolveQualifiers(standings: Standing[], rule: QualificationRule): Standing[] {
  const sorted = [...standings].sort((a, b) => a.rank - b.rank);
  switch (rule.method) {
    case 'top_n':
      return sorted.slice(0, rule.value);
    case 'top_percent':
      return sorted.slice(0, Math.ceil((rule.value / 100) * sorted.length));
    case 'threshold':
      return sorted.filter((s) => s.wins >= rule.value);
    default:
      return [];
  }
}
