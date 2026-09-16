"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPasscode, createSession, destroySession, requireSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import type { TypedSupabaseClient, Json } from "@pakangers/db";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { serializeTournamentAsTemplate, type TemplateConfig } from "@/lib/template-config";
import { populateTournament } from "@/lib/match-pipeline";

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
  const { data: defaultRuleSet } = await supabase.from("rule_set").select("id").limit(1).maybeSingle();

  const { data: tournament, error } = await supabase
    .from("tournament")
    .insert({
      name,
      slug,
      status: "draft",
      created_from_template_id: templateId || null,
      rule_set_id: defaultRuleSet?.id ?? null,
    })
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
  } else {
    // If created without a template, always seed a default Open Doubles division
    await supabase
      .from("division")
      .insert({ tournament_id: tournament.id, name: "Open Doubles", team_size: 2 });
  }

  revalidatePath("/admin");
  redirect(`/admin/${tournament.slug}`);
}

export async function updateTournamentInfo(slug: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const tournamentName = String(formData.get("name") ?? "").trim();
  const { data: tournament, error } = await supabase
    .from("tournament")
    .update({
      name: tournamentName,
      date_start: (formData.get("date_start") as string) || null,
      date_end: (formData.get("date_end") as string) || null,
      venue: (formData.get("venue") as string) || null,
      organizer_name: (formData.get("organizer_name") as string) || null,
      description: (formData.get("description") as string) || null,
    })
    .eq("slug", slug)
    .select("id")
    .single();
  if (error || !tournament) throw new Error(error?.message ?? "Failed to update tournament");

  const rawTeamSize = formData.get("team_size");
  if (rawTeamSize !== null) {
    const teamSize = Math.max(1, parseInt(String(rawTeamSize), 10) || 2);
    const defaultName = teamSize === 1 ? "Singles" : teamSize === 4 ? "Team Wars" : "Open Doubles";
    const divisionName = String(formData.get("division_name") ?? "").trim() || defaultName;

    const { data: existingDiv } = await supabase
      .from("division")
      .select("id")
      .eq("tournament_id", tournament.id)
      .limit(1)
      .maybeSingle();

    if (existingDiv) {
      await supabase
        .from("division")
        .update({ name: divisionName, team_size: teamSize })
        .eq("id", existingDiv.id);
    } else {
      await supabase
        .from("division")
        .insert({ tournament_id: tournament.id, name: divisionName, team_size: teamSize });
    }
  }

  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/admin/${slug}/setup/info`);
  revalidatePath(`/admin/${slug}/setup/teams`);
  revalidatePath(`/admin/${slug}/setup/review`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/info`);
}

/** Automatically creates 1v1 teams for all unassigned players in Singles mode */
export async function autoCreateSinglesTeams(
  slug: string,
  tournamentId: string,
  divisionId: string,
): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from("player").select("id, first_name, last_name").eq("tournament_id", tournamentId),
    supabase.from("team").select("id").eq("tournament_id", tournamentId),
  ]);

  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: memberships } = teamIds.length > 0
    ? await supabase.from("team_member").select("player_id").in("team_id", teamIds)
    : { data: [] };

  const assignedPlayerIds = new Set((memberships ?? []).map((m) => m.player_id));
  const unassignedPlayers = (players ?? []).filter((p) => !assignedPlayerIds.has(p.id));

  if (unassignedPlayers.length === 0) return;

  for (const player of unassignedPlayers) {
    const fullName = `${player.first_name} ${player.last_name}`.trim() || "Player";
    const { data: newTeam, error: teamErr } = await supabase
      .from("team")
      .insert({
        tournament_id: tournamentId,
        division_id: divisionId,
        name: fullName,
      })
      .select("id")
      .single();

    if (teamErr || !newTeam) continue;

    await supabase.from("team_member").insert({
      team_id: newTeam.id,
      player_id: player.id,
      position: 1,
    });
  }

  revalidatePath(`/admin/${slug}/setup/teams`);
  revalidatePath(`/admin/${slug}/setup/review`);
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

export async function updatePlayerAvatar(
  slug: string,
  playerId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; avatarUrl?: string }> {
  await requireSession();
  const supabase = getServiceSupabase();

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "No image file provided" };
  }

  // Reject files over 500KB (client already compresses to ~30KB)
  if (file.size > 524288) {
    return { ok: false, error: "Image file is too large. Please select a smaller photo." };
  }

  try {
    const ext = "webp";
    const path = `${playerId}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload directly as webp file to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("player-avatars")
      .upload(path, buffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadErr) {
      return { ok: false, error: `Storage upload failed: ${uploadErr.message}` };
    }

    const { data: urlData } = supabase.storage
      .from("player-avatars")
      .getPublicUrl(path);

    const finalAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Store ONLY the short public URL in database
    const { error: dbError } = await supabase
      .from("player")
      .update({ avatar_url: finalAvatarUrl })
      .eq("id", playerId);

    if (dbError) throw new Error(dbError.message);

    revalidatePath(`/admin/${slug}/setup/players`);
    revalidatePath(`/admin/${slug}/setup/teams`);
    revalidatePath(`/admin/${slug}/matches`);
    revalidatePath(`/t/${slug}`);
    revalidatePath(`/t/${slug}/matches`);
    revalidatePath(`/t/${slug}/standings`);
    revalidatePath(`/t/${slug}/bracket`);

    return { ok: true, avatarUrl: finalAvatarUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload photo";
    return { ok: false, error: message };
  }
}

export async function removePlayerAvatar(slug: string, playerId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("player").update({ avatar_url: null }).eq("id", playerId);
  if (error) throw new Error(error.message);

  // Best effort delete from storage
  try {
    await supabase.storage.from("player-avatars").remove([`${playerId}.webp`]);
  } catch {
    // Ignore storage deletion errors
  }

  revalidatePath(`/admin/${slug}/setup/players`);
  revalidatePath(`/admin/${slug}/setup/teams`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/matches`);
  revalidatePath(`/t/${slug}/standings`);
  revalidatePath(`/t/${slug}/bracket`);
}

export async function createTeam(slug: string, tournamentId: string, divisionId: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  let name = String(formData.get("name") ?? "").trim();
  const { data: existing } = await supabase.from("team").select("id").eq("tournament_id", tournamentId);
  const nextNum = (existing?.length ?? 0) + 1;

  if (!name) {
    const { data: div } = await supabase.from("division").select("team_size").eq("id", divisionId).single();
    if (div?.team_size === 1) {
      name = `Slot ${nextNum}`;
    } else if (div && div.team_size >= 4) {
      name = `Clan ${nextNum}`;
    } else {
      name = `Team ${nextNum}`;
    }
  }

  const { error } = await supabase.from("team").insert({
    tournament_id: tournamentId,
    division_id: divisionId,
    name,
    team_number: nextNum,
  });
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

export async function unlockTournament(slug: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament").update({ status: "draft" }).eq("slug", slug);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}`);
  revalidatePath("/admin");
}

export async function toggleTournamentLock(slug: string, targetState: "locked" | "draft"): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("tournament").update({ status: targetState }).eq("slug", slug);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
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
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (newRules.length > 0) {
        await supabase.from("qualification_rule").insert(newRules);
      }
    }
  }

  // 6. Copy player
  const { data: players } = await supabase
    .from("player")
    .select("id, first_name, last_name, contact, dupr_id, skill_rating, notes, avatar_url")
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
          avatar_url: p.avatar_url,
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
            .filter((m): m is NonNullable<typeof m> => m !== null);

          if (newMembers.length > 0) {
            await supabase.from("team_member").insert(newMembers);
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

/**
 * Configures the tournament's stages, pool groups, knockout rounds, and qualification rules.
 * Supports Round of 16 (Top 16), Quarterfinals (Top 8), Semifinals (Top 4), Finals, 3rd Place match,
 * and 1 to 4 pools with automatic crossover wiring.
 */
export async function configureTournamentStages(slug: string, formData: FormData): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const { data: tournament } = await supabase.from("tournament").select("id, status").eq("slug", slug).single();
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "draft") throw new Error("Cannot modify stages of a tournament that has started or is locked");

  const { data: division } = await supabase.from("division").select("id").eq("tournament_id", tournament.id).limit(1).single();
  if (!division) throw new Error("Division not found");

  const playoffFormat = String(formData.get("playoff_format") ?? "semifinals");
  const crossoverStyle = String(formData.get("crossover_style") ?? "opposite");
  const includePools = formData.get("include_pools") === "true";
  const poolCount = Math.min(16, Math.max(1, parseInt(String(formData.get("pool_count") ?? "2"), 10)));
  const advancePerPool = Math.min(2, Math.max(1, parseInt(String(formData.get("advance_per_pool") ?? "2"), 10)));
  const includeThirdPlace = formData.get("include_third_place") === "true";

  const pointsToWin = parseInt(String(formData.get("points_to_win") ?? "15"), 10) || 15;
  const winBy = String(formData.get("win_by") ?? "sudden_death");
  const bestOf = parseInt(String(formData.get("best_of") ?? "1"), 10) || 1;
  const scoringType = String(formData.get("scoring_type") ?? "side_out");

  // Round-specific scoring rules
  const poolPoints = parseInt(String(formData.get("pool_points_to_win") ?? String(pointsToWin)), 10) || pointsToWin;
  const poolWinBy = String(formData.get("pool_win_by") ?? winBy);

  const earlyPoints = pointsToWin;
  const earlyWinBy = winBy;

  const semisPoints = parseInt(String(formData.get("semis_points_to_win") ?? String(pointsToWin)), 10) || pointsToWin;
  const semisWinBy = String(formData.get("semis_win_by") ?? "sudden_death");

  const finalsPoints = parseInt(String(formData.get("finals_points_to_win") ?? String(pointsToWin)), 10) || pointsToWin;
  const finalsWinBy = String(formData.get("finals_win_by") ?? "win_by_two");

  const poolScoring = { pointsToWin: poolPoints, winBy: poolWinBy, bestOf, scoringType };
  const earlyScoring = { pointsToWin: earlyPoints, winBy: earlyWinBy, bestOf, scoringType };
  const semisScoring = { pointsToWin: semisPoints, winBy: semisWinBy, bestOf, scoringType };
  const finalsScoring = { pointsToWin: finalsPoints, winBy: finalsWinBy, bestOf, scoringType };

  // 1. Unassign all teams from groups first
  await supabase.from("team").update({ group_id: null }).eq("tournament_id", tournament.id);

  // 2. Fetch existing stage IDs to delete old qualification rules, groups, matches, and stages
  const { data: oldStages } = await supabase.from("stage").select("id").eq("tournament_id", tournament.id);
  const oldStageIds = (oldStages ?? []).map((s) => s.id);
  if (oldStageIds.length > 0) {
    await supabase.from("qualification_rule").delete().in("from_stage_id", oldStageIds);
    await supabase.from("qualification_rule").delete().in("to_stage_id", oldStageIds);
    await supabase.from("tournament_group").delete().in("stage_id", oldStageIds);
    await supabase.from("bracket_node").delete().in("stage_id", oldStageIds);
    await supabase.from("match").delete().in("stage_id", oldStageIds);
    await supabase.from("stage").delete().eq("tournament_id", tournament.id);
  }

  let currentSequence = 1;
  let poolStageId: string | null = null;
  const groupIdsByName = new Map<string, string>();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const poolNames = alphabet.slice(0, poolCount);

  // 3. Create Pool Stage if requested
  if (includePools) {
    const { data: poolStage, error: pErr } = await supabase
      .from("stage")
      .insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "pools",
        name: "Bracket",
        format_key: "round_robin",
        sequence: currentSequence++,
        scoring_config: poolScoring as unknown as Json,
        tiebreaker_config: ["match_wins", "point_differential", "points_scored"] as unknown as Json,
      })
      .select("id")
      .single();
    if (pErr || !poolStage) throw new Error(pErr?.message ?? "Failed to create pool stage");
    poolStageId = poolStage.id;

    for (let i = 0; i < poolNames.length; i++) {
      const gName = poolNames[i]!;
      const { data: grp } = await supabase
        .from("tournament_group")
        .insert({
          stage_id: poolStage.id,
          name: gName,
          display_order: i,
        })
        .select("id")
        .single();
      if (grp) groupIdsByName.set(gName, grp.id);
    }
  }

  // 4. Create Knockout Stages based on playoff_format
  if (playoffFormat === "round_of_16") {
    // Round of 16 (Top 16)
    let r16EntrantConfig: Record<string, unknown> = {};
    if (includePools && poolCount === 8 && advancePerPool >= 2) {
      // If opposite crossover (user's preferred local format): A1 vs H2, B1 vs G2, C1 vs F2, D1 vs E2, etc.
      if (crossoverStyle === "opposite") {
        r16EntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "H", rank: 2 } },
            { match: 2, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "G", rank: 2 } },
            { match: 3, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "F", rank: 2 } },
            { match: 4, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "E", rank: 2 } },
            { match: 5, home: { kind: "group_rank", group: "E", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 2 } },
            { match: 6, home: { kind: "group_rank", group: "F", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 2 } },
            { match: 7, home: { kind: "group_rank", group: "G", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 2 } },
            { match: 8, home: { kind: "group_rank", group: "H", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 2 } },
          ],
        };
      } else {
        r16EntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 2 } },
            { match: 2, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 2 } },
            { match: 3, home: { kind: "group_rank", group: "E", rank: 1 }, away: { kind: "group_rank", group: "F", rank: 2 } },
            { match: 4, home: { kind: "group_rank", group: "G", rank: 1 }, away: { kind: "group_rank", group: "H", rank: 2 } },
            { match: 5, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 2 } },
            { match: 6, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 2 } },
            { match: 7, home: { kind: "group_rank", group: "F", rank: 1 }, away: { kind: "group_rank", group: "E", rank: 2 } },
            { match: 8, home: { kind: "group_rank", group: "H", rank: 1 }, away: { kind: "group_rank", group: "G", rank: 2 } },
          ],
        };
      }
    } else if (includePools && poolCount === 16 && advancePerPool >= 1) {
      if (crossoverStyle === "opposite") {
        r16EntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "P", rank: 1 } },
            { match: 2, home: { kind: "group_rank", group: "H", rank: 1 }, away: { kind: "group_rank", group: "I", rank: 1 } },
            { match: 3, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "M", rank: 1 } },
            { match: 4, home: { kind: "group_rank", group: "E", rank: 1 }, away: { kind: "group_rank", group: "L", rank: 1 } },
            { match: 5, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "O", rank: 1 } },
            { match: 6, home: { kind: "group_rank", group: "G", rank: 1 }, away: { kind: "group_rank", group: "J", rank: 1 } },
            { match: 7, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "N", rank: 1 } },
            { match: 8, home: { kind: "group_rank", group: "F", rank: 1 }, away: { kind: "group_rank", group: "K", rank: 1 } },
          ],
        };
      } else {
        r16EntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 1 } },
            { match: 2, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 1 } },
            { match: 3, home: { kind: "group_rank", group: "E", rank: 1 }, away: { kind: "group_rank", group: "F", rank: 1 } },
            { match: 4, home: { kind: "group_rank", group: "G", rank: 1 }, away: { kind: "group_rank", group: "H", rank: 1 } },
            { match: 5, home: { kind: "group_rank", group: "I", rank: 1 }, away: { kind: "group_rank", group: "J", rank: 1 } },
            { match: 6, home: { kind: "group_rank", group: "K", rank: 1 }, away: { kind: "group_rank", group: "L", rank: 1 } },
            { match: 7, home: { kind: "group_rank", group: "M", rank: 1 }, away: { kind: "group_rank", group: "N", rank: 1 } },
            { match: 8, home: { kind: "group_rank", group: "O", rank: 1 }, away: { kind: "group_rank", group: "P", rank: 1 } },
          ],
        };
      }
    } else if (includePools && poolCount === 4 && advancePerPool >= 4) {
      if (crossoverStyle === "opposite") {
        r16EntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 4 } },
            { match: 2, home: { kind: "group_rank", group: "B", rank: 2 }, away: { kind: "group_rank", group: "C", rank: 3 } },
            { match: 3, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 4 } },
            { match: 4, home: { kind: "group_rank", group: "D", rank: 2 }, away: { kind: "group_rank", group: "A", rank: 3 } },
            { match: 5, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 4 } },
            { match: 6, home: { kind: "group_rank", group: "A", rank: 2 }, away: { kind: "group_rank", group: "D", rank: 3 } },
            { match: 7, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 4 } },
            { match: 8, home: { kind: "group_rank", group: "C", rank: 2 }, away: { kind: "group_rank", group: "B", rank: 3 } },
          ],
        };
      } else {
        r16EntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 4 } },
            { match: 2, home: { kind: "group_rank", group: "C", rank: 2 }, away: { kind: "group_rank", group: "D", rank: 3 } },
            { match: 3, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 4 } },
            { match: 4, home: { kind: "group_rank", group: "D", rank: 2 }, away: { kind: "group_rank", group: "C", rank: 3 } },
            { match: 5, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 4 } },
            { match: 6, home: { kind: "group_rank", group: "A", rank: 2 }, away: { kind: "group_rank", group: "B", rank: 3 } },
            { match: 7, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 4 } },
            { match: 8, home: { kind: "group_rank", group: "B", rank: 2 }, away: { kind: "group_rank", group: "A", rank: 3 } },
          ],
        };
      }
    } else if (includePools && poolCount === 2 && advancePerPool >= 8) {
      r16EntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 8 } },
          { match: 2, home: { kind: "group_rank", group: "A", rank: 5 }, away: { kind: "group_rank", group: "B", rank: 4 } },
          { match: 3, home: { kind: "group_rank", group: "A", rank: 3 }, away: { kind: "group_rank", group: "B", rank: 6 } },
          { match: 4, home: { kind: "group_rank", group: "A", rank: 7 }, away: { kind: "group_rank", group: "B", rank: 2 } },
          { match: 5, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 8 } },
          { match: 6, home: { kind: "group_rank", group: "B", rank: 5 }, away: { kind: "group_rank", group: "A", rank: 4 } },
          { match: 7, home: { kind: "group_rank", group: "B", rank: 3 }, away: { kind: "group_rank", group: "A", rank: 6 } },
          { match: 8, home: { kind: "group_rank", group: "B", rank: 7 }, away: { kind: "group_rank", group: "A", rank: 2 } },
        ],
      };
    }

    const { data: r16 } = await supabase
      .from("stage")
      .insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "round_of_16",
        name: "Round of 16",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: earlyScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: r16EntrantConfig as unknown as Json,
      })
      .select("id")
      .single();

    if (poolStageId && r16) {
      for (const gName of poolNames) {
        const gId = groupIdsByName.get(gName);
        if (gId) {
          await supabase.from("qualification_rule").insert({
            from_stage_id: poolStageId,
            from_group_id: gId,
            method: "top_n",
            value: advancePerPool,
            to_stage_id: r16.id,
          });
        }
      }
    }

    // Quarterfinals
    await supabase.from("stage").insert({
      tournament_id: tournament.id,
      division_id: division.id,
      key: "quarterfinals",
      name: "Quarterfinals",
      format_key: "single_elimination",
      sequence: currentSequence++,
      scoring_config: earlyScoring as unknown as Json,
      tiebreaker_config: [] as unknown as Json,
      entrant_config: {
        entrants: [
          { match: 1, home: { kind: "match_outcome", stage: "round_of_16", match: 1, outcome: "winner" }, away: { kind: "match_outcome", stage: "round_of_16", match: 2, outcome: "winner" } },
          { match: 2, home: { kind: "match_outcome", stage: "round_of_16", match: 3, outcome: "winner" }, away: { kind: "match_outcome", stage: "round_of_16", match: 4, outcome: "winner" } },
          { match: 3, home: { kind: "match_outcome", stage: "round_of_16", match: 5, outcome: "winner" }, away: { kind: "match_outcome", stage: "round_of_16", match: 6, outcome: "winner" } },
          { match: 4, home: { kind: "match_outcome", stage: "round_of_16", match: 7, outcome: "winner" }, away: { kind: "match_outcome", stage: "round_of_16", match: 8, outcome: "winner" } },
        ],
      } as unknown as Json,
    });

    // Semifinals
    await supabase.from("stage").insert({
      tournament_id: tournament.id,
      division_id: division.id,
      key: "semifinals",
      name: "Semifinals",
      format_key: "single_elimination",
      sequence: currentSequence++,
      scoring_config: semisScoring as unknown as Json,
      tiebreaker_config: [] as unknown as Json,
      entrant_config: {
        entrants: [
          { match: 1, home: { kind: "match_outcome", stage: "quarterfinals", match: 1, outcome: "winner" }, away: { kind: "match_outcome", stage: "quarterfinals", match: 2, outcome: "winner" } },
          { match: 2, home: { kind: "match_outcome", stage: "quarterfinals", match: 3, outcome: "winner" }, away: { kind: "match_outcome", stage: "quarterfinals", match: 4, outcome: "winner" } },
        ],
      } as unknown as Json,
    });

    if (includeThirdPlace) {
      await supabase.from("stage").insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "third_place",
        name: "Third Place",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: finalsScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: {
          entrants: [
            { match: 1, home: { kind: "match_outcome", stage: "semifinals", match: 1, outcome: "loser" }, away: { kind: "match_outcome", stage: "semifinals", match: 2, outcome: "loser" } },
          ],
        } as unknown as Json,
      });
    }

    // Championship
    await supabase.from("stage").insert({
      tournament_id: tournament.id,
      division_id: division.id,
      key: "championship",
      name: "Championship",
      format_key: "single_elimination",
      sequence: currentSequence++,
      scoring_config: finalsScoring as unknown as Json,
      tiebreaker_config: [] as unknown as Json,
      entrant_config: {
        entrants: [
          { match: 1, home: { kind: "match_outcome", stage: "semifinals", match: 1, outcome: "winner" }, away: { kind: "match_outcome", stage: "semifinals", match: 2, outcome: "winner" } },
        ],
      } as unknown as Json,
    });
  } else if (playoffFormat === "quarterfinals") {
    // Quarterfinals (Top 8)
    let qfEntrantConfig: Record<string, unknown> = {};
    if (includePools && poolCount === 8 && advancePerPool >= 1) {
      if (crossoverStyle === "opposite") {
        qfEntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "H", rank: 1 } },
            { match: 2, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "G", rank: 1 } },
            { match: 3, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "F", rank: 1 } },
            { match: 4, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "E", rank: 1 } },
          ],
        };
      } else {
        qfEntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 1 } },
            { match: 2, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 1 } },
            { match: 3, home: { kind: "group_rank", group: "E", rank: 1 }, away: { kind: "group_rank", group: "F", rank: 1 } },
            { match: 4, home: { kind: "group_rank", group: "G", rank: 1 }, away: { kind: "group_rank", group: "H", rank: 1 } },
          ],
        };
      }
    } else if (includePools && poolCount === 4 && advancePerPool >= 2) {
      if (crossoverStyle === "opposite") {
        qfEntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 2 } },
            { match: 2, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 2 } },
            { match: 3, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 2 } },
            { match: 4, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 2 } },
          ],
        };
      } else {
        qfEntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 2 } },
            { match: 2, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 2 } },
            { match: 3, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 2 } },
            { match: 4, home: { kind: "group_rank", group: "D", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 2 } },
          ],
        };
      }
    } else if (includePools && poolCount === 2 && advancePerPool >= 4) {
      qfEntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 4 } },
          { match: 2, home: { kind: "group_rank", group: "A", rank: 3 }, away: { kind: "group_rank", group: "B", rank: 2 } },
          { match: 3, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 4 } },
          { match: 4, home: { kind: "group_rank", group: "B", rank: 3 }, away: { kind: "group_rank", group: "A", rank: 2 } },
        ],
      };
    } else if (includePools && poolCount === 1 && advancePerPool >= 8) {
      qfEntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 8 } },
          { match: 2, home: { kind: "group_rank", group: "A", rank: 4 }, away: { kind: "group_rank", group: "A", rank: 5 } },
          { match: 3, home: { kind: "group_rank", group: "A", rank: 2 }, away: { kind: "group_rank", group: "A", rank: 7 } },
          { match: 4, home: { kind: "group_rank", group: "A", rank: 3 }, away: { kind: "group_rank", group: "A", rank: 6 } },
        ],
      };
    }

    const { data: qf } = await supabase
      .from("stage")
      .insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "quarterfinals",
        name: "Quarterfinals",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: earlyScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: qfEntrantConfig as unknown as Json,
      })
      .select("id")
      .single();

    if (poolStageId && qf) {
      for (const gName of poolNames) {
        const gId = groupIdsByName.get(gName);
        if (gId) {
          await supabase.from("qualification_rule").insert({
            from_stage_id: poolStageId,
            from_group_id: gId,
            method: "top_n",
            value: advancePerPool,
            to_stage_id: qf.id,
          });
        }
      }
    }

    // Semifinals
    await supabase.from("stage").insert({
      tournament_id: tournament.id,
      division_id: division.id,
      key: "semifinals",
      name: "Semifinals",
      format_key: "single_elimination",
      sequence: currentSequence++,
      scoring_config: semisScoring as unknown as Json,
      tiebreaker_config: [] as unknown as Json,
      entrant_config: {
        entrants: [
          { match: 1, home: { kind: "match_outcome", stage: "quarterfinals", match: 1, outcome: "winner" }, away: { kind: "match_outcome", stage: "quarterfinals", match: 2, outcome: "winner" } },
          { match: 2, home: { kind: "match_outcome", stage: "quarterfinals", match: 3, outcome: "winner" }, away: { kind: "match_outcome", stage: "quarterfinals", match: 4, outcome: "winner" } },
        ],
      } as unknown as Json,
    });

    if (includeThirdPlace) {
      await supabase.from("stage").insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "third_place",
        name: "Third Place",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: finalsScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: {
          entrants: [
            { match: 1, home: { kind: "match_outcome", stage: "semifinals", match: 1, outcome: "loser" }, away: { kind: "match_outcome", stage: "semifinals", match: 2, outcome: "loser" } },
          ],
        } as unknown as Json,
      });
    }

    // Championship
    await supabase.from("stage").insert({
      tournament_id: tournament.id,
      division_id: division.id,
      key: "championship",
      name: "Championship",
      format_key: "single_elimination",
      sequence: currentSequence++,
      scoring_config: finalsScoring as unknown as Json,
      tiebreaker_config: [] as unknown as Json,
      entrant_config: {
        entrants: [
          { match: 1, home: { kind: "match_outcome", stage: "semifinals", match: 1, outcome: "winner" }, away: { kind: "match_outcome", stage: "semifinals", match: 2, outcome: "winner" } },
        ],
      } as unknown as Json,
    });
  } else if (playoffFormat === "semifinals") {
    // Semifinals (Top 4)
    let semiEntrantConfig: Record<string, unknown> = {};
    if (includePools && poolCount === 4 && advancePerPool >= 1) {
      if (crossoverStyle === "opposite") {
        semiEntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 1 } },
            { match: 2, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "C", rank: 1 } },
          ],
        };
      } else {
        semiEntrantConfig = {
          entrants: [
            { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 1 } },
            { match: 2, home: { kind: "group_rank", group: "C", rank: 1 }, away: { kind: "group_rank", group: "D", rank: 1 } },
          ],
        };
      }
    } else if (includePools && poolCount >= 2 && advancePerPool >= 2) {
      semiEntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 2 } },
          { match: 2, home: { kind: "group_rank", group: "B", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 2 } },
        ],
      };
    } else if (includePools && poolCount === 1 && advancePerPool >= 4) {
      semiEntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 4 } },
          { match: 2, home: { kind: "group_rank", group: "A", rank: 2 }, away: { kind: "group_rank", group: "A", rank: 3 } },
        ],
      };
    }

    const { data: semis } = await supabase
      .from("stage")
      .insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "semifinals",
        name: "Semifinals",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: semisScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: semiEntrantConfig as unknown as Json,
      })
      .select("id")
      .single();

    if (poolStageId && semis) {
      for (const gName of poolNames) {
        const gId = groupIdsByName.get(gName);
        if (gId) {
          await supabase.from("qualification_rule").insert({
            from_stage_id: poolStageId,
            from_group_id: gId,
            method: "top_n",
            value: advancePerPool,
            to_stage_id: semis.id,
          });
        }
      }
    }

    if (includeThirdPlace) {
      await supabase.from("stage").insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "third_place",
        name: "Third Place",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: finalsScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: {
          entrants: [
            { match: 1, home: { kind: "match_outcome", stage: "semifinals", match: 1, outcome: "loser" }, away: { kind: "match_outcome", stage: "semifinals", match: 2, outcome: "loser" } },
          ],
        } as unknown as Json,
      });
    }

    // Championship
    await supabase.from("stage").insert({
      tournament_id: tournament.id,
      division_id: division.id,
      key: "championship",
      name: "Championship",
      format_key: "single_elimination",
      sequence: currentSequence++,
      scoring_config: finalsScoring as unknown as Json,
      tiebreaker_config: [] as unknown as Json,
      entrant_config: {
        entrants: [
          { match: 1, home: { kind: "match_outcome", stage: "semifinals", match: 1, outcome: "winner" }, away: { kind: "match_outcome", stage: "semifinals", match: 2, outcome: "winner" } },
        ],
      } as unknown as Json,
    });
  } else if (playoffFormat === "finals_only") {
    let finalsEntrantConfig: Record<string, unknown> = {};
    if (includePools && poolCount >= 2) {
      finalsEntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "B", rank: 1 } },
        ],
      };
    } else if (includePools && poolCount === 1 && advancePerPool >= 2) {
      finalsEntrantConfig = {
        entrants: [
          { match: 1, home: { kind: "group_rank", group: "A", rank: 1 }, away: { kind: "group_rank", group: "A", rank: 2 } },
        ],
      };
    }

    const { data: finals } = await supabase
      .from("stage")
      .insert({
        tournament_id: tournament.id,
        division_id: division.id,
        key: "championship",
        name: "Championship",
        format_key: "single_elimination",
        sequence: currentSequence++,
        scoring_config: finalsScoring as unknown as Json,
        tiebreaker_config: [] as unknown as Json,
        entrant_config: finalsEntrantConfig as unknown as Json,
      })
      .select("id")
      .single();

    if (poolStageId && finals) {
      for (const gName of poolNames) {
        const gId = groupIdsByName.get(gName);
        if (gId) {
          await supabase.from("qualification_rule").insert({
            from_stage_id: poolStageId,
            from_group_id: gId,
            method: "top_n",
            value: 1,
            to_stage_id: finals.id,
          });
        }
      }
    }
  }

  // Populate matches and bracket nodes immediately
  await populateTournament(tournament.id).catch((err) => {
    console.warn("populateTournament after configure stages non-fatal error:", err);
  });

  revalidatePath(`/admin/${slug}/setup/stages`);
  revalidatePath(`/admin/${slug}/setup/groups`);
  revalidatePath(`/admin/${slug}/setup/review`);
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/bracket`);
}

/** Distributes teams in fair snake order across existing pools */
export async function snakeSeedTeams(slug: string, tournamentId: string, stageId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const [{ data: groups }, { data: teams }] = await Promise.all([
    supabase.from("tournament_group").select("id, name").eq("stage_id", stageId).order("display_order"),
    supabase.from("team").select("id, name, seed").eq("tournament_id", tournamentId).order("seed", { nullsFirst: false }).order("name"),
  ]);

  if (!groups || groups.length === 0) throw new Error("No pools found for this stage");
  if (!teams || teams.length === 0) throw new Error("No teams to assign");

  const numGroups = groups.length;
  for (let i = 0; i < teams.length; i++) {
    const cycle = Math.floor(i / numGroups);
    const pos = i % numGroups;
    const groupIndex = cycle % 2 === 0 ? pos : numGroups - 1 - pos;
    const targetGroup = groups[groupIndex]!;

    await supabase.from("team").update({ group_id: targetGroup.id }).eq("id", teams[i]!.id);
  }

  await populateTournament(tournamentId).catch((err) => {
    console.warn("populateTournament after snakeSeedTeams non-fatal error:", err);
  });

  revalidatePath(`/admin/${slug}/setup/groups`);
  revalidatePath(`/admin/${slug}/setup/review`);
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/bracket`);
  revalidatePath(`/t/${slug}/standings`);
}

/** Adds a new pool (e.g. Pool C) to an existing round-robin stage */
export async function addPoolGroup(slug: string, stageId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const { data: existing } = await supabase.from("tournament_group").select("name").eq("stage_id", stageId).order("display_order");
  const nextOrder = existing?.length ?? 0;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const name = alphabet[nextOrder] ?? `Pool ${nextOrder + 1}`;

  const { error } = await supabase.from("tournament_group").insert({
    stage_id: stageId,
    name,
    display_order: nextOrder,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/groups`);
}

/** Removes a pool */
export async function removePoolGroup(slug: string, groupId: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  await supabase.from("team").update({ group_id: null }).eq("group_id", groupId);
  const { error } = await supabase.from("tournament_group").delete().eq("id", groupId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/groups`);
}

/** Renames a pool/bracket group */
export async function renamePoolGroup(slug: string, groupId: string, newName: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Bracket name cannot be empty");

  const { error } = await supabase
    .from("tournament_group")
    .update({ name: trimmed })
    .eq("id", groupId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/groups`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/standings`);
}

/** Sets the exact number of brackets in a round-robin stage (allowed: 1, 2, 4, 8) */
export async function setBracketCount(slug: string, stageId: string, targetCount: number): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  if (![1, 2, 4, 8].includes(targetCount)) {
    throw new Error("Invalid bracket count. Allowed counts: 1, 2, 4, or 8");
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("tournament_group")
    .select("id, name, display_order")
    .eq("stage_id", stageId)
    .order("display_order");

  if (fetchErr) throw new Error(fetchErr.message);

  const currentGroups = existing ?? [];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  if (currentGroups.length < targetCount) {
    // Add missing brackets
    for (let i = currentGroups.length; i < targetCount; i++) {
      const name = alphabet[i] ?? `Bracket ${i + 1}`;
      const { error: insErr } = await supabase.from("tournament_group").insert({
        stage_id: stageId,
        name,
        display_order: i,
      });
      if (insErr) throw new Error(insErr.message);
    }
  } else if (currentGroups.length > targetCount) {
    // Remove extra brackets beyond targetCount (from the end)
    const toRemove = currentGroups.slice(targetCount);
    const removeIds = toRemove.map((g) => g.id);

    // Unassign teams in removed brackets
    await supabase.from("team").update({ group_id: null }).in("group_id", removeIds);
    const { error: delErr } = await supabase.from("tournament_group").delete().in("id", removeIds);
    if (delErr) throw new Error(delErr.message);
  }

  // Synchronize qualification rules for all current groups in this stage
  const { data: existingRules } = await supabase
    .from("qualification_rule")
    .select("to_stage_id, method, value")
    .eq("from_stage_id", stageId);

  if (existingRules && existingRules.length > 0) {
    const toStageId = existingRules[0]!.to_stage_id;
    const method = existingRules[0]!.method;
    const value = existingRules[0]!.value;

    await supabase.from("qualification_rule").delete().eq("from_stage_id", stageId);

    const { data: allGroups } = await supabase
      .from("tournament_group")
      .select("id")
      .eq("stage_id", stageId);

    for (const g of allGroups ?? []) {
      await supabase.from("qualification_rule").insert({
        from_stage_id: stageId,
        from_group_id: g.id,
        method,
        value,
        to_stage_id: toStageId,
      });
    }
  }

  revalidatePath(`/admin/${slug}/setup/groups`);
  revalidatePath(`/admin/${slug}/setup/stages`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/bracket`);
  revalidatePath(`/t/${slug}/standings`);
}

/** Renames a team in a tournament */
export async function renameTeam(slug: string, teamId: string, newName: string): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Team name cannot be empty");

  const { error } = await supabase
    .from("team")
    .update({ name: trimmed })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/setup/groups`);
  revalidatePath(`/admin/${slug}/setup/teams`);
  revalidatePath(`/admin/${slug}/matches`);
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/bracket`);
  revalidatePath(`/t/${slug}/standings`);
}

/** Randomly partners unassigned players into doubles teams (teams of 2) */
export async function randomizeDoublesPartners(
  slug: string,
  tournamentId: string,
  divisionId: string
): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const [{ data: players }, { data: existingTeams }, { data: existingMembers }] = await Promise.all([
    supabase.from("player").select("id, first_name, last_name").eq("tournament_id", tournamentId),
    supabase.from("team").select("id, team_number").eq("tournament_id", tournamentId),
    supabase.from("team_member").select("player_id"),
  ]);

  const assignedPlayerIds = new Set((existingMembers ?? []).map((m) => m.player_id));
  const unassigned = (players ?? []).filter((p) => !assignedPlayerIds.has(p.id));

  if (unassigned.length < 2) {
    throw new Error("Need at least 2 unassigned players to form random doubles pairs.");
  }

  // Fisher-Yates shuffle
  const shuffled = [...unassigned];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  let nextTeamNumber = (existingTeams?.length ?? 0) + 1;
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const p1 = shuffled[i]!;
    const p2 = shuffled[i + 1]!;

    const { data: team, error: teamErr } = await supabase
      .from("team")
      .insert({
        tournament_id: tournamentId,
        division_id: divisionId,
        name: `Team ${nextTeamNumber}`,
        team_number: nextTeamNumber,
      })
      .select("id")
      .single();

    if (teamErr || !team) throw new Error(teamErr?.message ?? "Failed to create doubles team");

    await supabase.from("team_member").insert([
      { team_id: team.id, player_id: p1.id, position: 1 },
      { team_id: team.id, player_id: p2.id, position: 2 },
    ]);

    nextTeamNumber++;
  }

  revalidatePath(`/admin/${slug}/setup/teams`);
  revalidatePath(`/admin/${slug}/setup/review`);
  revalidatePath(`/admin/${slug}`);
}

/** Saves customized rubbers for Team Wars match tie lineup */
export async function saveTeamWarsLineup(slug: string, rubbers: string[]): Promise<void> {
  await requireSession();
  const supabase = getServiceSupabase();

  const { data: tournament, error: tErr } = await supabase
    .from("tournament")
    .select("id, schedule_config")
    .eq("slug", slug)
    .single();
  if (tErr || !tournament) throw new Error("Tournament not found");

  const currentConfig = (tournament.schedule_config ?? {}) as Record<string, unknown>;
  const updatedConfig = { ...currentConfig, team_wars_rubbers: rubbers };

  const { error: updateErr } = await supabase
    .from("tournament")
    .update({ schedule_config: updatedConfig as unknown as Json })
    .eq("id", tournament.id);

  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/admin/${slug}/setup/info`);
  revalidatePath(`/admin/${slug}/setup/stages`);
  revalidatePath(`/admin/${slug}`);
}



