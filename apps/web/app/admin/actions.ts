"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPasscode, createSession, destroySession, requireSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import type { TypedSupabaseClient, Json } from "@pakangers/db";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { serializeTournamentAsTemplate, type TemplateConfig } from "@/lib/template-config";

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
  revalidatePath(`/t/${slug}`);
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

/** Reverts a locked/in-progress/completed tournament back to draft so its setup can be edited again. */
export async function unlockTournament(slug: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament").update({ status: "draft" }).eq("slug", slug);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}`);
}

/** Permanently deletes a tournament and everything under it (players, teams, matches, audit log --
 * every child table cascades from tournament_id per packages/db/migrations/0001_initial_schema.sql). */
export async function deleteTournament(tournamentId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament").delete().eq("id", tournamentId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/**
 * The other half of reuse (docs/04-organizer-ui.md A1/A7): stores this
 * tournament's *configuration* as a new template so next year can start from
 * what actually worked, rather than only from the generic starters. Copies no
 * players, teams, or scores -- serializeTournamentAsTemplate reads structure
 * only. source_tournament_id records where it came from.
 */
export async function saveAsTemplate(slug: string, formData: FormData): Promise<void> {
  await requireSession();
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) throw new Error("Tournament not found");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give the template a name");
  const description = String(formData.get("description") ?? "").trim();

  const config = await serializeTournamentAsTemplate(tournament.id);
  if (config.stages.length === 0) throw new Error("This tournament has no stages to save");

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament_template").insert({
    name,
    description: description || null,
    config: config as unknown as Json,
    source_tournament_id: tournament.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/${slug}/setup/stages`);
}

/** Deeply duplicates a tournament: Info, Custom Rules, Courts, Divisions, Stages, Groups, Qualification Rules, Players, Teams, and Team Members. */
async function deepDuplicateTournament(
  supabase: TypedSupabaseClient,
  sourceId: string,
  targetId: string,
): Promise<void> {
  // 1. Copy tournament_rule
  const { data: rules } = await supabase
    .from("tournament_rule")
    .select("category, title, summary_text, source_ref, display_order")
    .eq("tournament_id", sourceId);

  if (rules && rules.length > 0) {
    await supabase.from("tournament_rule").insert(
      rules.map((r) => ({
        ...r,
        tournament_id: targetId,
      })),
    );
  }

  // 2. Copy court
  const { data: courts } = await supabase
    .from("court")
    .select("id, name, is_available")
    .eq("tournament_id", sourceId);

  if (courts && courts.length > 0) {
    await supabase.from("court").insert(
      courts.map((c) => ({
        tournament_id: targetId,
        name: c.name,
        is_available: c.is_available,
      })),
    );
  }

  // 3. Copy division
  const { data: divisions } = await supabase
    .from("division")
    .select("id, name, skill_level, team_size, gender_category")
    .eq("tournament_id", sourceId);

  const divisionIdMap = new Map<string, string>();
  if (divisions) {
    for (const div of divisions) {
      const { data: newDiv } = await supabase
        .from("division")
        .insert({
          tournament_id: targetId,
          name: div.name,
          skill_level: div.skill_level,
          team_size: div.team_size,
          gender_category: div.gender_category,
        })
        .select("id")
        .single();
      if (newDiv) {
        divisionIdMap.set(div.id, newDiv.id);
      }
    }
  }

  // 4. Copy stage & tournament_group
  const { data: stages } = await supabase
    .from("stage")
    .select("id, division_id, key, name, format_key, sequence, scoring_config, tiebreaker_config, entrant_config")
    .eq("tournament_id", sourceId);

  const stageIdMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();

  if (stages) {
    for (const stg of stages) {
      const newDivId = divisionIdMap.get(stg.division_id);
      if (!newDivId) continue;

      const { data: newStage } = await supabase
        .from("stage")
        .insert({
          tournament_id: targetId,
          division_id: newDivId,
          key: stg.key,
          name: stg.name,
          format_key: stg.format_key,
          sequence: stg.sequence,
          scoring_config: stg.scoring_config,
          tiebreaker_config: stg.tiebreaker_config,
          entrant_config: stg.entrant_config,
        })
        .select("id")
        .single();

      if (newStage) {
        stageIdMap.set(stg.id, newStage.id);

        const { data: groups } = await supabase
          .from("tournament_group")
          .select("id, name, display_order")
          .eq("stage_id", stg.id);

        if (groups) {
          for (const grp of groups) {
            const { data: newGrp } = await supabase
              .from("tournament_group")
              .insert({
                stage_id: newStage.id,
                name: grp.name,
                display_order: grp.display_order,
              })
              .select("id")
              .single();
            if (newGrp) {
              groupIdMap.set(grp.id, newGrp.id);
            }
          }
        }
      }
    }
  }

  // 5. Copy qualification_rule
  if (stageIdMap.size > 0) {
    const oldStageIds = Array.from(stageIdMap.keys());
    const { data: qualRules } = await supabase
      .from("qualification_rule")
      .select("from_stage_id, from_group_id, method, value, to_stage_id, seeding_policy")
      .in("from_stage_id", oldStageIds);

    if (qualRules && qualRules.length > 0) {
      const newRules = qualRules
        .map((r) => {
          const newFromStage = stageIdMap.get(r.from_stage_id);
          const newToStage = stageIdMap.get(r.to_stage_id);
          if (!newFromStage || !newToStage) return null;

          return {
            from_stage_id: newFromStage,
            from_group_id: r.from_group_id ? groupIdMap.get(r.from_group_id) ?? null : null,
            method: r.method,
            value: r.value,
            to_stage_id: newToStage,
            seeding_policy: r.seeding_policy,
          };
        })
        .filter(Boolean);

      if (newRules.length > 0) {
        await supabase.from("qualification_rule").insert(newRules as any);
      }
    }
  }

  // 6. Copy player
  const { data: players } = await supabase
    .from("player")
    .select("id, first_name, last_name, contact, dupr_id, skill_rating, notes")
    .eq("tournament_id", sourceId);

  const playerIdMap = new Map<string, string>();
  if (players && players.length > 0) {
    for (const p of players) {
      const { data: newP } = await supabase
        .from("player")
        .insert({
          tournament_id: targetId,
          first_name: p.first_name,
          last_name: p.last_name,
          contact: p.contact,
          dupr_id: p.dupr_id,
          skill_rating: p.skill_rating,
          notes: p.notes,
        })
        .select("id")
        .single();
      if (newP) {
        playerIdMap.set(p.id, newP.id);
      }
    }
  }

  // 7. Copy team & team_member
  const { data: teams } = await supabase
    .from("team")
    .select("id, division_id, name, team_number, seed, group_id")
    .eq("tournament_id", sourceId);

  if (teams && teams.length > 0) {
    for (const t of teams) {
      const newDivId = divisionIdMap.get(t.division_id);
      if (!newDivId) continue;

      const newGrpId = t.group_id ? groupIdMap.get(t.group_id) ?? null : null;

      const { data: newTeam } = await supabase
        .from("team")
        .insert({
          tournament_id: targetId,
          division_id: newDivId,
          name: t.name,
          team_number: t.team_number,
          seed: t.seed,
          group_id: newGrpId,
        })
        .select("id")
        .single();

      if (newTeam) {
        const { data: members } = await supabase
          .from("team_member")
          .select("player_id, position")
          .eq("team_id", t.id);

        if (members && members.length > 0) {
          const newMembers = members
            .map((m) => {
              const newPlayerId = playerIdMap.get(m.player_id);
              if (!newPlayerId) return null;
              return {
                team_id: newTeam.id,
                player_id: newPlayerId,
                position: m.position,
              };
            })
            .filter(Boolean);

          if (newMembers.length > 0) {
            await supabase.from("team_member").insert(newMembers as any);
          }
        }
      }
    }
  }
}

/** Creates a deep copy of an existing tournament (Info, Players, Teams, Groups, Stages, Rules) in 'draft' status. */
export async function duplicateTournament(tournamentId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const { data: source, error: sourceError } = await supabase
    .from("tournament")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (sourceError || !source) throw new Error("Source tournament not found");

  const name = `${source.name} (Copy)`;
  const slug = slugify(name);

  const { data: newTournament, error: createError } = await supabase
    .from("tournament")
    .insert({
      name,
      slug,
      date_start: source.date_start,
      date_end: source.date_end,
      venue: source.venue,
      organizer_name: source.organizer_name,
      description: source.description,
      status: "draft",
      rule_set_id: source.rule_set_id,
      timezone: source.timezone,
      created_from_template_id: source.created_from_template_id,
      schedule_config: source.schedule_config,
    })
    .select("id, slug")
    .single();

  if (createError || !newTournament) {
    throw new Error(createError?.message ?? "Failed to create tournament copy");
  }

  await deepDuplicateTournament(supabase, source.id, newTournament.id);

  revalidatePath("/admin");
  redirect(`/admin/${newTournament.slug}`);
}

/** Automatically seeds the draft copy '1st Pakangers Exclusive Tournament (Copy)' if missing in database. */
export async function ensurePakangersCopyExists(): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: existingCopy } = await supabase
    .from("tournament")
    .select("id")
    .eq("slug", "pakangers-2026-copy")
    .maybeSingle();

  if (existingCopy) return;

  const { data: original } = await supabase
    .from("tournament")
    .select("*")
    .eq("slug", "pakangers-2026")
    .maybeSingle();

  if (!original) return;

  const { data: newTournament, error: createError } = await supabase
    .from("tournament")
    .insert({
      name: "1st Pakangers Exclusive Tournament (Copy)",
      slug: "pakangers-2026-copy",
      date_start: original.date_start,
      date_end: original.date_end,
      venue: original.venue,
      organizer_name: original.organizer_name,
      description: original.description,
      status: "draft",
      rule_set_id: original.rule_set_id,
      timezone: original.timezone,
      created_from_template_id: original.created_from_template_id,
      schedule_config: original.schedule_config,
    })
    .select("id")
    .single();

  if (createError || !newTournament) return;

  await deepDuplicateTournament(supabase, original.id, newTournament.id);
}



