import { notFound } from "next/navigation";
import { getTournamentBySlug, getDivisionForTournament } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { createTeam, deleteTeam, assignPlayerToTeam, removePlayerFromTeam, randomizeDoublesPartners } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatTeamDisplay } from "@/lib/team-display";
import { PlayerAvatar, TeamAvatarGroup } from "@/components/PlayerAvatar";

export default async function SetupTeamsPage({ params }: PageProps<"/admin/[slug]/setup/teams">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();
  let division = await getDivisionForTournament(tournament.id);
  if (!division) {
    division = {
      id: "",
      tournament_id: tournament.id,
      name: "Open Doubles",
      team_size: 2,
      skill_level: null,
      gender_category: null,
      created_at: new Date().toISOString(),
    };
  }

  const isSingles = division.team_size === 1;
  const isTeamWars = division.team_size >= 4;
  const isDoubles = !isSingles && !isTeamWars;

  const supabase = getServiceSupabase();
  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from("player").select("id, first_name, last_name, avatar_url").eq("tournament_id", tournament.id).order("first_name"),
    supabase.from("team").select("id, name, team_number").eq("tournament_id", tournament.id).order("team_number", { ascending: true, nullsFirst: false }).order("name"),
  ]);

  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: memberships } = teamIds.length > 0
    ? await supabase.from("team_member").select("team_id, player_id").in("team_id", teamIds)
    : { data: [] };

  const assignedPlayerIds = new Set((memberships ?? []).map((m) => m.player_id));
  const unassignedPlayers = (players ?? []).filter((p) => !assignedPlayerIds.has(p.id));

  const membersByTeam = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(m.player_id);
    membersByTeam.set(m.team_id, list);
  }
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));

  const createAction = createTeam.bind(null, slug, tournament.id, division.id);
  const randomizeAction = randomizeDoublesPartners.bind(null, slug, tournament.id, division.id);

  const nextNumber = (teams?.length ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Doubles Random Partnering Toolbar */}
      {isDoubles && unassignedPlayers.length >= 2 && tournament.status === "draft" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border-2 border-[var(--color-navy)] bg-white p-4 shadow-sm">
          <div>
            <h4 className="font-bold text-sm text-[var(--color-navy)] flex items-center gap-1.5">
              <span>🎲</span> Random Doubles Partnering
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              {unassignedPlayers.length} unassigned players available. Automatically shuffle and pair them into 2-player teams:
            </p>
          </div>
          <form action={randomizeAction}>
            <Button type="submit" size="sm">
              🎲 Randomly Partner Players ({Math.floor(unassignedPlayers.length / 2)} teams)
            </Button>
          </form>
        </div>
      )}

      {/* Creation Card */}
      <Card
        title={
          isSingles
            ? "Create Player Slot / Entrant"
            : isTeamWars
            ? "Create Clan / Squad"
            : "Create Doubles Team"
        }
      >
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          {isSingles
            ? "Creates an entrant slot (e.g. Slot 1). You can manually assign registered players to slots below."
            : isTeamWars
            ? "Create competitive clan/squad entries. Players are manually assigned by clan (random pairing disabled)."
            : "Create a doubles team. Enter a custom name or leave blank for automatic numbering (Team 1, Team 2...)."
          }
        </p>
        <form action={createAction} className="flex gap-3">
          <div className="flex-1">
            <Input
              name="name"
              placeholder={
                isSingles
                  ? `Slot ${nextNumber} (optional)`
                  : isTeamWars
                  ? "Clan / Squad name (e.g. Tanjay Smashers)"
                  : `Team ${nextNumber} (optional)`
              }
            />
          </div>
          <Button type="submit">
            {isSingles ? "+ Add Slot" : isTeamWars ? "+ Add Clan" : "+ Add Team"}
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        {teams?.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">No teams yet — create one above.</p>
        )}
        {teams?.map((team) => {
          const memberIds = membersByTeam.get(team.id) ?? [];
          const full = memberIds.length >= division.team_size;
          const memberPlayers = memberIds.map((pid) => {
            const p = playerById.get(pid);
            return p ? { id: p.id, name: `${p.first_name} ${p.last_name}`.trim(), avatarUrl: p.avatar_url } : null;
          }).filter((p): p is NonNullable<typeof p> => Boolean(p));
          const display = formatTeamDisplay(team.name, memberPlayers.map(p => p.name), memberPlayers);
          return (
            <Card key={team.id} accent={false} className="border border-[var(--border-subtle)]">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TeamAvatarGroup players={memberPlayers} size="sm" />
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase text-[var(--color-navy)]">
                      {display.header}
                    </h3>
                    {display.subtext && <p className="text-xs text-[var(--color-text-muted)]">{display.subtext}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={full ? "success" : "neutral"}>
                    {memberIds.length}/{division.team_size}
                  </Badge>
                  <form action={deleteTeam.bind(null, slug, team.id)}>
                    <button type="submit" className="text-sm font-medium text-[var(--color-error)] hover:underline">
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {memberIds.map((pid) => {
                  const player = playerById.get(pid);
                  return (
                    <div key={pid} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar
                          name={player ? `${player.first_name} ${player.last_name}` : pid}
                          avatarUrl={player?.avatar_url}
                          size="xs"
                        />
                        <span>{player ? `${player.first_name} ${player.last_name}` : pid}</span>
                      </div>
                      <form action={removePlayerFromTeam.bind(null, slug, team.id, pid)}>
                        <button type="submit" className="text-xs font-medium text-[var(--color-error)] hover:underline">
                          Remove
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>

              {!full && (
                <form action={assignPlayerToTeam.bind(null, slug, team.id)} className="mt-3 flex gap-2">
                  <select name="playerId" className="flex-1 rounded-lg border-2 border-[var(--border-subtle)] px-3 py-2 text-sm" required>
                    <option value="">Add a player…</option>
                    {unassignedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    Add
                  </Button>
                </form>
              )}
            </Card>
          );
        })}
      </div>

      <Card title={`Unassigned players (${unassignedPlayers.length})`}>
        {unassignedPlayers.length === 0 ? (
          <p className="text-sm text-[var(--color-success)]">Every registered player is on a team.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {unassignedPlayers.map((p) => (
              <li key={p.id} className="rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-sm">
                {p.first_name} {p.last_name}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
