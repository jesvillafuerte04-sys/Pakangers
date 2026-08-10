import "server-only";
import { getServiceSupabase } from "./supabase-server";
import type { PlannedMatchEntrants } from "@pakangers/engine";

/**
 * The shape stored in tournament_template.config. This is the contract between
 * createTournament's instantiateFromTemplate (which reads it) and
 * serializeTournamentAsTemplate below (which writes it), so it lives here
 * rather than privately in either one.
 *
 * It matches what the seeded starter templates already store -- see
 * packages/db/migrations/0006_seed_reference_data.sql -- and the entrant slot
 * refs are structurally the engine's own PlannedMatchEntrants.
 */
export type TemplateStageConfig = {
  key: string;
  name: string;
  formatKey: string;
  sequence: number;
  scoring: Record<string, unknown>;
  tiebreakers: string[];
  /**
   * `size` is informational only: instantiation creates the group by name and
   * membership comes from assigning teams by hand. Kept for fidelity with the
   * seeded templates, which include it.
   */
  groups?: { name: string; size: number }[];
  entrants?: PlannedMatchEntrants[];
};

export type TemplateQualificationConfig = {
  fromStage: string;
  fromGroup?: string;
  method: string;
  value: number;
  toStage: string;
};

export type TemplateConfig = {
  divisions: { key: string; name: string; teamSize: number }[];
  stages: TemplateStageConfig[];
  qualification: TemplateQualificationConfig[];
};

/**
 * Reads a live tournament's configuration back out into template form: the
 * division, every stage with its scoring/tiebreakers/slot wiring, each stage's
 * groups, and the qualification rules connecting them.
 *
 * Configuration only -- never players, teams, or scores. Per
 * docs/04-organizer-ui.md a template is what made this year's tournament work,
 * so next year can start from it.
 */
export async function serializeTournamentAsTemplate(tournamentId: string): Promise<TemplateConfig> {
  const supabase = getServiceSupabase();

  const [{ data: divisions }, { data: stages }, { data: teams }] = await Promise.all([
    supabase.from("division").select("id, name, team_size").eq("tournament_id", tournamentId),
    supabase
      .from("stage")
      .select("id, key, name, format_key, sequence, scoring_config, tiebreaker_config, entrant_config")
      .eq("tournament_id", tournamentId)
      .order("sequence"),
    supabase.from("team").select("id, group_id").eq("tournament_id", tournamentId),
  ]);

  const stageIds = (stages ?? []).map((s) => s.id);
  const [{ data: groups }, { data: qualRules }] = await Promise.all([
    stageIds.length
      ? supabase.from("tournament_group").select("id, stage_id, name, display_order").in("stage_id", stageIds)
      : Promise.resolve({ data: [] as { id: string; stage_id: string; name: string; display_order: number }[] }),
    stageIds.length
      ? supabase
          .from("qualification_rule")
          .select("from_stage_id, from_group_id, method, value, to_stage_id")
          .in("from_stage_id", stageIds)
      : Promise.resolve({
          data: [] as {
            from_stage_id: string;
            from_group_id: string | null;
            method: string;
            value: number;
            to_stage_id: string;
          }[],
        }),
  ]);

  const stageKeyById = new Map((stages ?? []).map((s) => [s.id, s.key]));
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

  // Group "size" is taken from how many teams are actually in it, which is the
  // most useful thing to carry forward even though instantiation ignores it.
  const teamCountByGroup = new Map<string, number>();
  for (const t of teams ?? []) {
    if (!t.group_id) continue;
    teamCountByGroup.set(t.group_id, (teamCountByGroup.get(t.group_id) ?? 0) + 1);
  }

  const templateStages: TemplateStageConfig[] = (stages ?? []).map((s) => {
    const entrantConfig = (s.entrant_config ?? {}) as { entrants?: PlannedMatchEntrants[] };
    const stageGroups = (groups ?? [])
      .filter((g) => g.stage_id === s.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((g) => ({ name: g.name, size: teamCountByGroup.get(g.id) ?? 0 }));

    const stage: TemplateStageConfig = {
      key: s.key,
      name: s.name,
      formatKey: s.format_key,
      sequence: s.sequence,
      scoring: (s.scoring_config ?? {}) as Record<string, unknown>,
      tiebreakers: ((s.tiebreaker_config ?? []) as string[]) ?? [],
    };
    if (stageGroups.length > 0) stage.groups = stageGroups;
    if (entrantConfig.entrants?.length) stage.entrants = entrantConfig.entrants;
    return stage;
  });

  const qualification: TemplateQualificationConfig[] = (qualRules ?? []).flatMap((r) => {
    const fromStage = stageKeyById.get(r.from_stage_id);
    const toStage = stageKeyById.get(r.to_stage_id);
    if (!fromStage || !toStage) return [];
    const fromGroup = r.from_group_id ? groupById.get(r.from_group_id)?.name : undefined;
    return [{ fromStage, ...(fromGroup ? { fromGroup } : {}), method: r.method, value: r.value, toStage }];
  });

  const division = (divisions ?? [])[0];

  return {
    divisions: division
      ? [{ key: division.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), name: division.name, teamSize: division.team_size }]
      : [],
    stages: templateStages,
    qualification,
  };
}
