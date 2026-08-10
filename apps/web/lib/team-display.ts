import "server-only";
import { getServiceSupabase } from "./supabase-server";

export type TeamDisplay = { header: string; subtext: string | null };

/** Player names lead; the team name (if the organizer bothered to set one) is a secondary label. */
export function formatTeamDisplay(teamName: string | null | undefined, playerNames: string[]): TeamDisplay {
  const trimmedName = (teamName ?? "").trim();
  if (playerNames.length > 0) {
    return { header: playerNames.join(" / "), subtext: trimmedName || null };
  }
  return { header: trimmedName || "Unnamed team", subtext: null };
}

export async function getTeamDisplayMap(teamIds: string[]): Promise<Map<string, TeamDisplay>> {
  const uniqueIds = [...new Set(teamIds)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = getServiceSupabase();
  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from("team").select("id, name").in("id", uniqueIds),
    supabase.from("team_member").select("team_id, position, player_id").in("team_id", uniqueIds).order("position"),
  ]);

  const playerIds = [...new Set((members ?? []).map((m) => m.player_id))];
  const { data: players } = playerIds.length
    ? await supabase.from("player").select("id, first_name, last_name").in("id", playerIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const playerNameById = new Map((players ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));

  const playerNamesByTeam = new Map<string, string[]>();
  for (const m of members ?? []) {
    const name = playerNameById.get(m.player_id);
    if (!name) continue;
    const list = playerNamesByTeam.get(m.team_id) ?? [];
    list.push(name);
    playerNamesByTeam.set(m.team_id, list);
  }

  const result = new Map<string, TeamDisplay>();
  for (const t of teams ?? []) {
    result.set(t.id, formatTeamDisplay(t.name, playerNamesByTeam.get(t.id) ?? []));
  }
  return result;
}
