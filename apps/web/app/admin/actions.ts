"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPasscode, createSession, destroySession, requireSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import type { TypedSupabaseClient, Json } from "@pakangers/db";

export type UnlockState = { error?: string };

export async function unlockOrganizer(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const passcode = String(formData.get("passcode") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Enter your name too — it's attached to every score you record." };

  const ok = await verifyPasscode(passcode);
  if (!ok) return { error: "That passcode doesn't match. Try again — nothing is locked out." };

  await createSession(name);
  redirect("/admin");
}

export async function signOutOrganizer(): Promise<void> {
  await requireSession();
  await destroySession();
  redirect("/admin");
}

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "tournament"}-${Date.now().toString(36)}`;
}

type TemplateStageConfig = {
  key: string;
  name: string;
  formatKey: string;
  sequence: number;
  scoring: Record<string, unknown>;
  tiebreakers: string[];
  groups?: { name: string; size: number }[];
  entrants?: unknown[];
};

type TemplateConfig = {
  divisions: { key: string; name: string; teamSize: number }[];
  stages: TemplateStageConfig[];
  qualification: { fromStage: string; fromGroup?: string; method: string; value: number; toStage: string }[];
};

/**
 * Reads a template's config JSON and builds the real structure underneath a
 * new tournament: division, every stage, every stage's groups, and every
 * qualification rule connecting them. This is the actual "reuse this
 * platform for a future tournament" mechanism, not a one-off script -- it
 * works identically for any template, seeded or organizer-saved.
 */
async function instantiateFromTemplate(
  supabase: TypedSupabaseClient,
  tournamentId: string,
  config: TemplateConfig,
): Promise<void> {
  const division = config.divisions[0];
  if (!division) return;

  const { data: divisionRow, error: divisionError } = await supabase
    .from("division")
    .insert({ tournament_id: tournamentId, name: division.name, team_size: division.teamSize })
    .select("id")
    .single();
  if (divisionError || !divisionRow) throw new Error(divisionError?.message ?? "Failed to create division");

  const stageIdByKey = new Map<string, string>();
  const groupIdByStageAndName = new Map<string, string>();

  for (const stage of config.stages) {
    const { data: stageRow, error: stageError } = await supabase
      .from("stage")
      .insert({
        tournament_id: tournamentId,
        division_id: divisionRow.id,
        key: stage.key,
        name: stage.name,
        format_key: stage.formatKey,
        sequence: stage.sequence,
        scoring_config: stage.scoring as Json,
        tiebreaker_config: stage.tiebreakers as Json,
        entrant_config: (stage.entrants ? { entrants: stage.entrants } : {}) as Json,
      })
      .select("id")
      .single();
    if (stageError || !stageRow) throw new Error(stageError?.message ?? `Failed to create stage "${stage.key}"`);
    stageIdByKey.set(stage.key, stageRow.id);

    if (stage.groups) {
      for (let i = 0; i < stage.groups.length; i++) {
        const g = stage.groups[i]!;
        const { data: groupRow, error: groupError } = await supabase
          .from("tournament_group")
          .insert({ stage_id: stageRow.id, name: g.name, display_order: i })
          .select("id")
          .single();
        if (groupError || !groupRow) throw new Error(groupError?.message ?? `Failed to create group "${g.name}"`);
        groupIdByStageAndName.set(`${stage.key}:${g.name}`, groupRow.id);
      }
    }
  }

  for (const rule of config.qualification) {
    const fromStageId = stageIdByKey.get(rule.fromStage);
    const toStageId = stageIdByKey.get(rule.toStage);
    if (!fromStageId || !toStageId) continue;
    const fromGroupId = rule.fromGroup ? groupIdByStageAndName.get(`${rule.fromStage}:${rule.fromGroup}`) : null;

    const { error: ruleError } = await supabase.from("qualification_rule").insert({
      from_stage_id: fromStageId,
      from_group_id: fromGroupId ?? null,
      method: rule.method,
      value: rule.value,
      to_stage_id: toStageId,
    });
    if (ruleError) throw new Error(ruleError.message);
  }
}

export async function createTournament(formData: FormData): Promise<void> {
  await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "");
  if (!name) throw new Error("Tournament name is required");

  const supabase = getServiceSupabase();
  const slug = slugify(name);

  const { data: tournament, error } = await supabase
    .from("tournament")
    .insert({ name, slug, status: "draft", created_from_template_id: templateId || null })
    .select("id, slug")
    .single();
  if (error || !tournament) throw new Error(error?.message ?? "Failed to create tournament");

  if (templateId) {
    const { data: template, error: templateError } = await supabase
      .from("tournament_template")
      .select("config")
      .eq("id", templateId)
      .single();
    if (templateError) throw new Error(templateError.message);
    if (template) {
      await instantiateFromTemplate(supabase, tournament.id, template.config as unknown as TemplateConfig);
    }
  }

  revalidatePath("/admin");
  redirect(`/admin/${tournament.slug}`);
}

export async function updateTournamentInfo(slug: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from("tournament")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      date_start: (formData.get("date_start") as string) || null,
      date_end: (formData.get("date_end") as string) || null,
      venue: (formData.get("venue") as string) || null,
      organizer_name: (formData.get("organizer_name") as string) || null,
      description: (formData.get("description") as string) || null,
    })
    .eq("slug", slug);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}`);
}

export async function addPlayers(slug: string, tournamentId: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const raw = String(formData.get("names") ?? "");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const rows = lines.map((line) => {
    const parts = line.split(/\s+/);
    const first_name = parts[0] ?? line;
    const last_name = parts.slice(1).join(" ") || "";
    return { tournament_id: tournamentId, first_name, last_name };
  });

  const { error } = await supabase.from("player").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/players`);
}

export async function removePlayer(slug: string, playerId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("player").delete().eq("id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/setup/players`);
}

export async function createTeam(slug: string, tournamentId: string, divisionId: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Team name is required");

  const { error } = await supabase.from("team").insert({ tournament_id: tournamentId, division_id: divisionId, name });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/teams`);
}

export async function deleteTeam(slug: string, teamId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("team").delete().eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/setup/teams`);
}

export async function assignPlayerToTeam(slug: string, teamId: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const playerId = String(formData.get("playerId") ?? "");
  if (!playerId) throw new Error("Choose a player to add");

  // Clear any existing assignment for this player first (a swap, not an add).
  await supabase.from("team_member").delete().eq("player_id", playerId);

  const { data: existing } = await supabase.from("team_member").select("player_id").eq("team_id", teamId);
  const position = (existing?.length ?? 0) + 1;

  const { error } = await supabase.from("team_member").insert({ team_id: teamId, player_id: playerId, position });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/teams`);
}

export async function removePlayerFromTeam(slug: string, teamId: string, playerId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("team_member").delete().eq("team_id", teamId).eq("player_id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/setup/teams`);
}

export async function assignTeamToGroup(slug: string, teamId: string, groupId: string | null): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("team").update({ group_id: groupId }).eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/setup/groups`);
}

export async function lockTournament(slug: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament").update({ status: "locked" }).eq("slug", slug);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}`);
  redirect(`/admin/${slug}`);
}
