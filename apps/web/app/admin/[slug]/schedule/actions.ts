"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getSchedulableInputs, readScheduleOptions } from "@/lib/schedule-data";
import { autoSchedule } from "@pakangers/engine";

async function requireTournament(slug: string) {
  await requireSession();
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) throw new Error("Tournament not found");
  return tournament;
}

function revalidateSchedule(slug: string): void {
  revalidatePath(`/admin/${slug}/schedule`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/t/${slug}/matches`);
}

export async function addCourt(slug: string, formData: FormData): Promise<void> {
  const tournament = await requireTournament(slug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("court").insert({ tournament_id: tournament.id, name });
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}

export async function renameCourt(slug: string, courtId: string, formData: FormData): Promise<void> {
  await requireTournament(slug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("court").update({ name }).eq("id", courtId);
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}

/** Frees every match on the court first, so nothing is left pointing at a deleted row. */
export async function removeCourt(slug: string, courtId: string): Promise<void> {
  await requireTournament(slug);
  const supabase = getServiceSupabase();

  const { error: clearError } = await supabase
    .from("match")
    .update({ court_id: null, display_order: null })
    .eq("court_id", courtId);
  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase.from("court").delete().eq("id", courtId);
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}

export async function setCourtAvailability(slug: string, courtId: string, isAvailable: boolean): Promise<void> {
  await requireTournament(slug);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("court").update({ is_available: isAvailable }).eq("id", courtId);
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}

export async function setMinRestRounds(slug: string, formData: FormData): Promise<void> {
  const tournament = await requireTournament(slug);
  const raw = Number(formData.get("minRestRounds") ?? 1);
  const minRestRounds = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 1;

  const supabase = getServiceSupabase();
  const existing = (tournament.schedule_config ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("tournament")
    .update({ schedule_config: { ...existing, minRestRounds } })
    .eq("id", tournament.id);
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}

/** Puts a match at the end of a court's queue, or unschedules it when courtId is null. */
export async function assignMatchToCourt(slug: string, matchId: string, courtId: string | null): Promise<void> {
  const tournament = await requireTournament(slug);
  const supabase = getServiceSupabase();

  if (courtId === null) {
    const { error } = await supabase.from("match").update({ court_id: null, display_order: null }).eq("id", matchId);
    if (error) throw new Error(error.message);
    revalidateSchedule(slug);
    return;
  }

  const { data: onCourt } = await supabase
    .from("match")
    .select("display_order")
    .eq("tournament_id", tournament.id)
    .eq("court_id", courtId)
    .not("display_order", "is", null);

  const nextRound = (onCourt ?? []).reduce((max, m) => Math.max(max, (m.display_order ?? -1) + 1), 0);

  const { error } = await supabase
    .from("match")
    .update({ court_id: courtId, display_order: nextRound })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}

/**
 * Swaps a match with its neighbour in the same court queue. Swapping (rather
 * than shifting everything) keeps the operation to two writes and can't leave
 * gaps in the ordering.
 */
export async function moveMatch(slug: string, matchId: string, direction: "up" | "down"): Promise<void> {
  const tournament = await requireTournament(slug);
  const supabase = getServiceSupabase();

  const { data: match } = await supabase.from("match").select("id, court_id, display_order").eq("id", matchId).single();
  if (!match?.court_id || match.display_order === null) return;

  const { data: siblings } = await supabase
    .from("match")
    .select("id, display_order")
    .eq("tournament_id", tournament.id)
    .eq("court_id", match.court_id)
    .not("display_order", "is", null)
    .order("display_order");

  const queue = siblings ?? [];
  const index = queue.findIndex((m) => m.id === matchId);
  const swapWith = direction === "up" ? queue[index - 1] : queue[index + 1];
  if (index === -1 || !swapWith) return;

  const [a, b] = await Promise.all([
    supabase.from("match").update({ display_order: swapWith.display_order }).eq("id", matchId),
    supabase.from("match").update({ display_order: match.display_order }).eq("id", swapWith.id),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  revalidateSchedule(slug);
}

/**
 * Greedy auto-assign over every not-yet-played match, using the engine. Played
 * matches keep whatever court they were on -- you can't reschedule history.
 */
export async function autoAssignSchedule(slug: string): Promise<void> {
  const tournament = await requireTournament(slug);
  const supabase = getServiceSupabase();

  const { matches, courts } = await getSchedulableInputs(tournament.id);
  const options = readScheduleOptions(tournament.schedule_config);
  const assignments = autoSchedule(matches, courts, options);

  for (const a of assignments) {
    const { error } = await supabase
      .from("match")
      .update({ court_id: a.courtId, display_order: a.round })
      .eq("id", a.matchId);
    if (error) throw new Error(error.message);
  }

  revalidateSchedule(slug);
}

/** Clears every court assignment for matches that haven't been played. */
export async function clearSchedule(slug: string): Promise<void> {
  const tournament = await requireTournament(slug);
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("match")
    .update({ court_id: null, display_order: null })
    .eq("tournament_id", tournament.id)
    .not("status", "in", "(completed,forfeit,bye)");
  if (error) throw new Error(error.message);
  revalidateSchedule(slug);
}
