"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import { getTournamentBySlug } from "@/lib/tournament-data";

async function requireTournament(slug: string) {
  await requireSession();
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) throw new Error("Tournament not found");
  return tournament;
}

function revalidateRules(slug: string): void {
  revalidatePath(`/admin/${slug}/rules`);
  revalidatePath(`/t/${slug}/info`);
}

/**
 * Which published rulebook this tournament runs under. Rule sets are chosen,
 * never edited here -- docs/03-data-model.md treats them as immutable once
 * referenced, with a new edition getting a new row.
 */
export async function setTournamentRuleSet(slug: string, formData: FormData): Promise<void> {
  const tournament = await requireTournament(slug);
  const ruleSetId = String(formData.get("ruleSetId") ?? "");

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("tournament")
    .update({ rule_set_id: ruleSetId || null })
    .eq("id", tournament.id);
  if (error) throw new Error(error.message);
  revalidateRules(slug);
}

export async function addTournamentRule(slug: string, formData: FormData): Promise<void> {
  const tournament = await requireTournament(slug);
  const title = String(formData.get("title") ?? "").trim();
  const summaryText = String(formData.get("summary_text") ?? "").trim();
  if (!title || !summaryText) return;

  const supabase = getServiceSupabase();
  const { data: existing } = await supabase
    .from("tournament_rule")
    .select("display_order")
    .eq("tournament_id", tournament.id);
  const nextOrder = (existing ?? []).reduce((max, r) => Math.max(max, r.display_order + 1), 0);

  const { error } = await supabase.from("tournament_rule").insert({
    tournament_id: tournament.id,
    rule_set_id: null, // tournament-specific, not a rule-set summary
    category: String(formData.get("category") ?? "general").trim() || "general",
    title,
    summary_text: summaryText,
    source_ref: String(formData.get("source_ref") ?? "").trim() || null,
    display_order: nextOrder,
  });
  if (error) throw new Error(error.message);
  revalidateRules(slug);
}

export async function updateTournamentRule(slug: string, ruleId: string, formData: FormData): Promise<void> {
  await requireTournament(slug);
  const title = String(formData.get("title") ?? "").trim();
  const summaryText = String(formData.get("summary_text") ?? "").trim();
  if (!title || !summaryText) return;

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("tournament_rule")
    .update({
      category: String(formData.get("category") ?? "general").trim() || "general",
      title,
      summary_text: summaryText,
      source_ref: String(formData.get("source_ref") ?? "").trim() || null,
    })
    .eq("id", ruleId);
  if (error) throw new Error(error.message);
  revalidateRules(slug);
}

export async function removeTournamentRule(slug: string, ruleId: string): Promise<void> {
  await requireTournament(slug);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament_rule").delete().eq("id", ruleId);
  if (error) throw new Error(error.message);
  revalidateRules(slug);
}

/** Swaps display_order with the neighbouring rule, same approach as the schedule queue. */
export async function moveTournamentRule(slug: string, ruleId: string, direction: "up" | "down"): Promise<void> {
  const tournament = await requireTournament(slug);
  const supabase = getServiceSupabase();

  const { data: rules } = await supabase
    .from("tournament_rule")
    .select("id, display_order")
    .eq("tournament_id", tournament.id)
    .order("display_order");

  const ordered = rules ?? [];
  const index = ordered.findIndex((r) => r.id === ruleId);
  const swapWith = direction === "up" ? ordered[index - 1] : ordered[index + 1];
  if (index === -1 || !swapWith) return;

  const [a, b] = await Promise.all([
    supabase.from("tournament_rule").update({ display_order: swapWith.display_order }).eq("id", ruleId),
    supabase.from("tournament_rule").update({ display_order: ordered[index]!.display_order }).eq("id", swapWith.id),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  revalidateRules(slug);
}
