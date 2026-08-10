import "server-only";
import { getServiceSupabase } from "./supabase-server";
import type { ScoringConfig } from "@pakangers/engine";
import { formatTeamDisplay, getTeamDisplayMap, type TeamDisplay } from "./team-display";

export type MatchListFilter = "live" | "upcoming" | "completed" | "all";

export type MatchListRow = {
  id: string;
  matchNumber: number;
  status: string;
  stageName: string;
  groupName: string | null;
  home: TeamDisplay;
  away: TeamDisplay;
  homeGamesWon: number | null;
  awayGamesWon: number | null;
  homePointsTotal: number | null;
  awayPointsTotal: number | null;
  resultType: string | null;
};

const TBD: TeamDisplay = { header: "TBD", subtext: null };
const BYE: TeamDisplay = { header: "Bye", subtext: null };

export async function getMatchList(tournamentId: string, filter: MatchListFilter = "upcoming"): Promise<MatchListRow[]> {
  const supabase = getServiceSupabase();

  const [{ data: matches, error }, { data: stages }, { data: groups }, { data: teams }, { data: results }, { data: players }] = await Promise.all([
    supabase.from("match").select("*").eq("tournament_id", tournamentId).order("match_number"),
    supabase.from("stage").select("id, name").eq("tournament_id", tournamentId),
    supabase.from("tournament_group").select("id, name"),
    supabase.from("team").select("id, name").eq("tournament_id", tournamentId),
    supabase.from("match_result").select("match_id, home_games_won, away_games_won, home_points_total, away_points_total, result_type"),
    supabase.from("player").select("id, first_name, last_name").eq("tournament_id", tournamentId),
  ]);
  if (error) throw new Error(error.message);

  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: members } = teamIds.length
    ? await supabase.from("team_member").select("team_id, position, player_id").in("team_id", teamIds).order("position")
    : { data: [] as { team_id: string; position: number; player_id: string }[] };

  const playerNameById = new Map((players ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
  const playerNamesByTeam = new Map<string, string[]>();
  for (const m of members ?? []) {
    const name = playerNameById.get(m.player_id);
    if (!name) continue;
    const list = playerNamesByTeam.get(m.team_id) ?? [];
    list.push(name);
    playerNamesByTeam.set(m.team_id, list);
  }
  const teamDisplayById = new Map((teams ?? []).map((t) => [t.id, formatTeamDisplay(t.name, playerNamesByTeam.get(t.id) ?? [])]));

  const stageNameById = new Map((stages ?? []).map((s) => [s.id, s.name]));
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const resultByMatchId = new Map((results ?? []).map((r) => [r.match_id, r]));

  const rows: MatchListRow[] = (matches ?? [])
    .filter((m) => m.home_team_id) // the pipeline only ever creates a row once at least the home slot resolves (away is null only for a bye)
    .map((m) => {
      const result = resultByMatchId.get(m.id);
      return {
        id: m.id,
        matchNumber: m.match_number,
        status: m.status,
        stageName: stageNameById.get(m.stage_id) ?? "",
        groupName: m.group_id ? groupNameById.get(m.group_id) ?? null : null,
        home: m.home_team_id ? teamDisplayById.get(m.home_team_id) ?? TBD : TBD,
        away: m.away_team_id ? teamDisplayById.get(m.away_team_id) ?? TBD : BYE,
        homeGamesWon: result?.home_games_won ?? null,
        awayGamesWon: result?.away_games_won ?? null,
        homePointsTotal: result?.home_points_total ?? null,
        awayPointsTotal: result?.away_points_total ?? null,
        resultType: result?.result_type ?? null,
      };
    });

  if (filter === "all") return rows;
  if (filter === "completed") return rows.filter((r) => ["completed", "forfeit", "bye"].includes(r.status));
  if (filter === "live") return rows.filter((r) => r.status === "in_progress");
  return rows.filter((r) => r.status === "pending" || r.status === "scheduled");
}

export type MatchDetail = {
  id: string;
  matchNumber: number;
  status: string;
  stageName: string;
  groupName: string | null;
  homeTeamId: string;
  awayTeamId: string;
  home: TeamDisplay;
  away: TeamDisplay;
  scoringConfig: ScoringConfig;
  existingGames: { gameNumber: number; homeScore: number; awayScore: number }[];
  priorResult: { resultType: string; recordedBy: string; recordedAt: string } | null;
};

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const supabase = getServiceSupabase();
  const { data: match } = await supabase.from("match").select("*").eq("id", matchId).single();
  if (!match || !match.home_team_id || !match.away_team_id) return null;

  const [{ data: stage }, { data: group }, { data: games }, { data: result }, teamDisplayById] = await Promise.all([
    supabase.from("stage").select("name").eq("id", match.stage_id).single(),
    match.group_id ? supabase.from("tournament_group").select("name").eq("id", match.group_id).single() : Promise.resolve({ data: null }),
    supabase.from("game").select("*").eq("match_id", matchId).order("game_number"),
    supabase.from("match_result").select("*").eq("match_id", matchId).maybeSingle(),
    getTeamDisplayMap([match.home_team_id, match.away_team_id]),
  ]);

  return {
    id: match.id,
    matchNumber: match.match_number,
    status: match.status,
    stageName: stage?.name ?? "",
    groupName: group?.name ?? null,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    home: teamDisplayById.get(match.home_team_id) ?? TBD,
    away: teamDisplayById.get(match.away_team_id) ?? TBD,
    scoringConfig: match.scoring_config as unknown as MatchDetail["scoringConfig"],
    existingGames: (games ?? []).map((g) => ({ gameNumber: g.game_number, homeScore: g.home_score, awayScore: g.away_score })),
    priorResult: result ? { resultType: result.result_type, recordedBy: result.recorded_by, recordedAt: result.recorded_at } : null,
  };
}

export async function getMatchProgress(tournamentId: string): Promise<{ completed: number; total: number }> {
  const supabase = getServiceSupabase();
  const [{ count: total }, { count: completed }] = await Promise.all([
    supabase.from("match").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase
      .from("match")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .in("status", ["completed", "forfeit", "bye"]),
  ]);
  return { completed: completed ?? 0, total: total ?? 0 };
}
