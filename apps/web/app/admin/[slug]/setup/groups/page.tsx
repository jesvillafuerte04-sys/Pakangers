import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { assignTeamToGroup } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";

export default async function SetupGroupsPage({ params }: PageProps<"/admin/[slug]/setup/groups">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const supabase = getServiceSupabase();
  const { data: stages } = await supabase
    .from("stage")
    .select("id, key, name")
    .eq("tournament_id", tournament.id)
    .eq("format_key", "round_robin");

  const poolStage = stages?.[0];
  if (!poolStage) {
    return (
      <Card title="Groups">
        <p className="text-sm text-[var(--color-text-muted)]">
          This tournament has no round-robin pool stage to assign groups for.
        </p>
      </Card>
    );
  }

  const [{ data: groups }, { data: teams }] = await Promise.all([
    supabase.from("tournament_group").select("id, name, display_order").eq("stage_id", poolStage.id).order("display_order"),
    supabase.from("team").select("id, name, group_id").eq("tournament_id", tournament.id).order("name"),
  ]);

  const unassigned = (teams ?? []).filter((t) => !t.group_id);

  return (
    <div className="flex flex-col gap-6">
      {groups?.map((group) => {
        const members = (teams ?? []).filter((t) => t.group_id === group.id);
        return (
          <Card key={group.id} title={`Pool ${group.name}`}>
            <div className="flex flex-col gap-1.5">
              {members.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No teams yet.</p>}
              {members.map((team) => (
                <div key={team.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                  <span>{team.name}</span>
                  <form action={assignTeamToGroup.bind(null, slug, team.id, null)}>
                    <button type="submit" className="text-xs font-medium text-[var(--color-error)] hover:underline">
                      Remove from pool
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <Card title={`Unassigned teams (${unassigned.length})`}>
        {unassigned.length === 0 ? (
          <p className="text-sm text-[var(--color-success)]">Every team is assigned to a pool.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {unassigned.map((team) => (
              <div key={team.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <span>{team.name}</span>
                <div className="flex gap-2">
                  {groups?.map((group) => (
                    <form key={group.id} action={assignTeamToGroup.bind(null, slug, team.id, group.id)}>
                      <button
                        type="submit"
                        className="rounded-full border-2 border-[var(--color-navy)] px-3 py-1 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-[var(--color-gold)]"
                      >
                        → {group.name}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
