"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { populateTournament, checkDownstreamInvalidation, writeMatchResult, type AffectedDownstreamMatch } from "@/lib/match-pipeline";
import { getSchedulableInputs, readScheduleOptions } from "@/lib/schedule-data";
import { autoSchedule, validateScoringConfig, validateGameScore, matchWinner, type Game, type ScoringConfig } from "@pakangers/engine";

export async function startTournament(slug: string): Promise<void> {
  await requireSession();
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "locked") throw new Error("Tournament must be locked before it can start");

  await populateTournament(tournament.id);

  const supabase = getServiceSupabase();

  // Give every bracket a court up front -- one bracket per court -- so the
  // schedule is usable the moment play starts. Anything already placed by hand
  // is left alone, and courts stay editable on the Schedule page afterwards.
  const { count: alreadyPlaced } = await supabase
    .from("match")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament.id)
    .not("court_id", "is", null);

  if (!alreadyPlaced) {
    const { matches, courts } = await getSchedulableInputs(tournament.id);
    const options = readScheduleOptions(tournament.schedule_config);
    for (const a of autoSchedule(matches, courts, options)) {
      if (!a.courtId) continue;
      await supabase.from("match").update({ court_id: a.courtId, display_order: a.round }).eq("id", a.matchId);
    }
  }

  const { error } = await supabase.from("tournament").update({ status: "in_progress" }).eq("id", tournament.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/admin/${slug}/schedule`);
  revalidatePath(`/t/${slug}/matches`);
}

/**
 * Flags a match as on-court right now, so it shows under the public Live tab (P1).
 * The court is chosen on the same button, because a live match with no court is
 * useless to anyone reading the Live tab at the venue.
 */
export async function markMatchLive(slug: string, matchId: string, formData: FormData): Promise<void> {
  await requireSession();
  const courtId = String(formData.get("courtId") ?? "").trim();
  if (!courtId) throw new Error("Pick a court before marking this match live.");

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("match")
    .update({ status: "in_progress", court_id: courtId })
    .eq("id", matchId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/admin/${slug}/schedule`);
}

export type ScorePayload =
  | { kind: "score"; games: { homeScore: number; awayScore: number }[] }
  | { kind: "forfeit"; winningTeamId: string; resultType: "forfeit" | "default" | "retired"; reason?: string };

export type SaveScoreResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; needsConfirmation: true; affected: AffectedDownstreamMatch[] };

export async function saveMatchScore(
  slug: string,
  matchId: string,
  payload: ScorePayload,
  confirmInvalidation: boolean,
): Promise<SaveScoreResult> {
  const session = await requireSession();
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) return { ok: false, error: "Tournament not found" };

  const supabase = getServiceSupabase();
  const { data: match } = await supabase.from("match").select("*").eq("id", matchId).single();
  if (!match || !match.home_team_id || !match.away_team_id) {
    return { ok: false, error: "This match doesn't have both teams assigned yet." };
  }

  let games: Game[];
  let winnerTeamId: string;
  let resultType: "normal" | "forfeit" | "default" | "retired";

  if (payload.kind === "forfeit") {
    const cfg = match.scoring_config as unknown as ScoringConfig;
    const gamesNeeded = Math.ceil(cfg.bestOf / 2);
    const winnerIsHome = payload.winningTeamId === match.home_team_id;
    games = Array.from({ length: gamesNeeded }, (_, i) => ({
      gameNumber: i + 1,
      homeScore: winnerIsHome ? cfg.pointsToWin : 0,
      awayScore: winnerIsHome ? 0 : cfg.pointsToWin,
    }));
    winnerTeamId = payload.winningTeamId;
    resultType = payload.resultType;
  } else {
    const cfg = match.scoring_config as unknown as ScoringConfig;
    const configIssues = validateScoringConfig(cfg);
    if (configIssues.length > 0) return { ok: false, error: configIssues[0]!.message };

    games = payload.games.map((g, i) => ({ gameNumber: i + 1, homeScore: g.homeScore, awayScore: g.awayScore }));
    for (const g of games) {
      const issues = validateGameScore(cfg, g);
      if (issues.length > 0) return { ok: false, error: issues[0]!.message };
    }
    const winnerSide = matchWinner(cfg, games);
    if (!winnerSide) return { ok: false, error: "Not enough games entered yet to determine a winner." };
    winnerTeamId = winnerSide === "home" ? match.home_team_id : match.away_team_id;
    resultType = "normal";
  }

  const isEdit = match.status === "completed" || match.status === "forfeit";
  if (isEdit && !confirmInvalidation) {
    const affected = await checkDownstreamInvalidation(tournament.id, matchId, games);
    if (affected.length > 0) return { ok: false, needsConfirmation: true, affected };
  }

  await writeMatchResult({
    tournamentId: tournament.id,
    matchId,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    games,
    winnerTeamId,
    resultType,
    actorName: session.name,
  });

  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/admin/${slug}/matches/${matchId}`);
  revalidatePath(`/admin/${slug}`);
  return { ok: true };
}
