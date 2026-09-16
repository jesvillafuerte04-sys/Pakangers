import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { assignTeamToGroup, snakeSeedTeams, removePoolGroup } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BracketNameEditor } from "./BracketNameEditor";
import { BracketCountSelector } from "./BracketCountSelector";
import { TeamNameEditor } from "./TeamNameEditor";

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
      <Card title="Round-Robin Brackets">
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            This tournament currently has no round-robin bracket stage configured.
          </p>
          <div>
            <Link href={`/admin/${slug}/setup/stages`}>
              <Button size="sm">Go to Stage Configurator ➔</Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const [{ data: groups }, { data: teams }] = await Promise.all([
    supabase
      .from("tournament_group")
      .select("id, name, display_order")
      .eq("stage_id", poolStage.id)
      .order("display_order"),
    supabase
      .from("team")
      .select("id, name, seed, group_id")
      .eq("tournament_id", tournament.id)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("name"),
  ]);

  const unassigned = (teams ?? []).filter((t) => !t.group_id);
  const isDraft = tournament.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar for Dynamic Brackets & Snake Seeding */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--color-navy)] bg-white p-4 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-base font-black uppercase text-[var(--color-navy)]">
              Brackets & Seeding
            </h2>
            <span className="rounded-full bg-[var(--color-gold)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--color-navy)]">
              {groups?.length ?? 0} {groups?.length === 1 ? "Bracket" : "Brackets"}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Balance teams across brackets with 1-click Snake Seeding, rename brackets & teams, or select bracket count.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isDraft && (
            <BracketCountSelector
              slug={slug}
              stageId={poolStage.id}
              currentCount={groups?.length ?? 0}
              isDraft={isDraft}
            />
          )}

          {isDraft && (
            <form action={snakeSeedTeams.bind(null, slug, tournament.id, poolStage.id)}>
              <Button type="submit" size="sm" disabled={(teams?.length ?? 0) === 0}>
                ⚡ Auto Snake Seed
              </Button>
            </form>
          )}
        </div>
      </div>

      {groups?.map((group) => {
        const members = (teams ?? []).filter((t) => t.group_id === group.id);
        return (
          <Card
            key={group.id}
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BracketNameEditor
                    slug={slug}
                    groupId={group.id}
                    initialName={group.name}
                    isDraft={isDraft}
                  />
                  <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-muted)]">
                    {members.length} {members.length === 1 ? "team" : "teams"}
                  </span>
                </div>
                {isDraft && (groups?.length ?? 0) > 1 && (
                  <form action={removePoolGroup.bind(null, slug, group.id)}>
                    <button
                      type="submit"
                      className="text-xs font-medium text-[var(--color-error)] hover:underline"
                    >
                      Delete Bracket
                    </button>
                  </form>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-1.5">
              {members.length === 0 && (
                <p className="py-2 text-sm text-[var(--color-text-muted)]">
                  No teams in this bracket yet. Click &quot;⚡ Auto Snake Seed&quot; above or assign teams below.
                </p>
              )}
              {members.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {team.seed && (
                      <span className="rounded bg-[var(--color-navy)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-gold)]">
                        #{team.seed}
                      </span>
                    )}
                    <TeamNameEditor
                      slug={slug}
                      teamId={team.id}
                      initialName={team.name}
                      isDraft={isDraft}
                    />
                  </div>
                  {isDraft && (
                    <form action={assignTeamToGroup.bind(null, slug, team.id, null)}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-[var(--color-error)] hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <Card title={`Unassigned teams (${unassigned.length})`}>
        {unassigned.length === 0 ? (
          <p className="text-sm text-[var(--color-success)]">Every team is assigned to a bracket.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {unassigned.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {team.seed && (
                    <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-navy)]">
                      #{team.seed}
                    </span>
                  )}
                  <TeamNameEditor
                    slug={slug}
                    teamId={team.id}
                    initialName={team.name}
                    isDraft={isDraft}
                  />
                </div>
                {isDraft && (
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
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
