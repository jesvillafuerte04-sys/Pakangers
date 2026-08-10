import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";
import { getTournamentTeamDisplays, type TeamDisplay } from "./team-display";
import {
  detectScheduleConflicts,
  DEFAULT_SCHEDULE_OPTIONS,
  type ScheduleAssignment,
  type SchedulableCourt,
  type SchedulableMatch,
  type ScheduleOptions,
} from "@pakangers/engine";
import type { ValidationIssue } from "@pakangers/engine";

const RESOLVED = ["completed", "forfeit", "bye"];

export type ScheduleRow = {
  matchId: string;
  matchNumber: number;
  stageName: string;
  groupName: string | null;
  home: TeamDisplay;
  away: TeamDisplay;
  courtId: string | null;
  round: number | null;
  isResolved: boolean;
  /** Conflicts attached to this specific match, so the UI can render them inline. */
  issues: ValidationIssue[];
};

export type ScheduleView = {
  courts: SchedulableCourt[];
  rows: ScheduleRow[];
  options: ScheduleOptions;
  /** Only ever populated with issues that aren't tied to a single match. */
  generalIssues: ValidationIssue[];
};

export function readScheduleOptions(scheduleConfig: unknown): ScheduleOptions {
  const cfg = (scheduleConfig ?? {}) as { minRestRounds?: unknown };
  const raw = typeof cfg.minRestRounds === "number" ? cfg.minRestRounds : DEFAULT_SCHEDULE_OPTIONS.minRestRounds;
  return { minRestRounds: Math.max(0, Math.trunc(raw)) };
}

export const getScheduleView = cache(async (tournamentId: string, scheduleConfig: unknown): Promise<ScheduleView> => {
  const supabase = getServiceSupabase();
  const options = readScheduleOptions(scheduleConfig);

  const [{ data: courtRows }, { data: matchRows }, { data: stages }, { data: groups }, teamDisplayById] =
    await Promise.all([
      supabase.from("court").select("id, name, is_available").eq("tournament_id", tournamentId).order("name"),
      supabase
        .from("match")
        .select("id, match_number, status, stage_id, group_id, home_team_id, away_team_id, court_id, display_order")
        .eq("tournament_id", tournamentId),
      supabase.from("stage").select("id, name, sequence").eq("tournament_id", tournamentId),
      supabase
        .from("tournament_group")
        .select("id, name, stage!inner(tournament_id)")
        .eq("stage.tournament_id", tournamentId),
      getTournamentTeamDisplays(tournamentId),
    ]);

  const courts: SchedulableCourt[] = (courtRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    isAvailable: c.is_available,
  }));
  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const playable = (matchRows ?? []).filter((m) => m.home_team_id);

  const engineMatches: SchedulableMatch[] = playable.map((m) => ({
    id: m.id,
    entrantIds: [m.home_team_id, m.away_team_id].filter((id): id is string => Boolean(id)),
    stageSequence: stageById.get(m.stage_id)?.sequence ?? 0,
    matchNumber: m.match_number,
    isResolved: RESOLVED.includes(m.status),
  }));

  const assignments: ScheduleAssignment[] = playable.map((m) => ({
    matchId: m.id,
    courtId: m.court_id,
    round: m.display_order,
  }));

  // Team names so conflict messages can name the offending team, not "this team".
  const entrantNames = new Map([...teamDisplayById].map(([id, d]) => [id, d.subtext || d.header]));
  const issues = detectScheduleConflicts(engineMatches, courts, assignments, options, entrantNames);
  const issuesByMatch = new Map<string, ValidationIssue[]>();
  const generalIssues: ValidationIssue[] = [];
  for (const issue of issues) {
    if (issue.entityRef?.type === "match") {
      const id = issue.entityRef.id;
      issuesByMatch.set(id, [...(issuesByMatch.get(id) ?? []), issue]);
    } else {
      generalIssues.push(issue);
    }
  }

  const TBD: TeamDisplay = { header: "TBD", subtext: null };
  const seqOf = (stageId: string) => stageById.get(stageId)?.sequence ?? 0;

  const rows: ScheduleRow[] = [...playable]
    .sort(
      (a, b) =>
        (a.display_order ?? Infinity) - (b.display_order ?? Infinity) ||
        seqOf(a.stage_id) - seqOf(b.stage_id) ||
        a.match_number - b.match_number,
    )
    .map((m) => ({
      matchId: m.id,
      matchNumber: m.match_number,
      stageName: stageById.get(m.stage_id)?.name ?? "",
      groupName: m.group_id ? groupNameById.get(m.group_id) ?? null : null,
      home: m.home_team_id ? teamDisplayById.get(m.home_team_id) ?? TBD : TBD,
      away: m.away_team_id ? teamDisplayById.get(m.away_team_id) ?? TBD : { header: "Bye", subtext: null },
      courtId: m.court_id,
      round: m.display_order,
      isResolved: RESOLVED.includes(m.status),
      issues: issuesByMatch.get(m.id) ?? [],
    }));

  return { courts, rows, options, generalIssues };
});

/** Matches + courts in the shape autoSchedule wants, without the display extras. */
export async function getSchedulableInputs(tournamentId: string): Promise<{
  matches: SchedulableMatch[];
  courts: SchedulableCourt[];
}> {
  const supabase = getServiceSupabase();
  const [{ data: courtRows }, { data: matchRows }, { data: stages }] = await Promise.all([
    supabase.from("court").select("id, name, is_available").eq("tournament_id", tournamentId).order("name"),
    supabase
      .from("match")
      .select("id, match_number, status, stage_id, home_team_id, away_team_id")
      .eq("tournament_id", tournamentId),
    supabase.from("stage").select("id, sequence").eq("tournament_id", tournamentId),
  ]);

  const seqByStage = new Map((stages ?? []).map((s) => [s.id, s.sequence]));

  return {
    courts: (courtRows ?? []).map((c) => ({ id: c.id, name: c.name, isAvailable: c.is_available })),
    matches: (matchRows ?? [])
      .filter((m) => m.home_team_id)
      .map((m) => ({
        id: m.id,
        entrantIds: [m.home_team_id, m.away_team_id].filter((id): id is string => Boolean(id)),
        stageSequence: seqByStage.get(m.stage_id) ?? 0,
        matchNumber: m.match_number,
        isResolved: RESOLVED.includes(m.status),
      })),
  };
}
