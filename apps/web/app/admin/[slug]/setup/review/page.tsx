import { notFound } from "next/navigation";
import { getTournamentBySlug, getDivisionForTournament } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { validateTeams } from "@pakangers/engine";
import { lockTournament } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function SetupReviewPage({ params }: PageProps<"/admin/[slug]/setup/review">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();
  const division = await getDivisionForTournament(tournament.id);

  const supabase = getServiceSupabase();
  const [{ data: players }, { data: teams }, { data: memberships }] = await Promise.all([
    supabase.from("player").select("id, first_name, last_name").eq("tournament_id", tournament.id),
    supabase.from("team").select("id, name").eq("tournament_id", tournament.id),
    supabase.from("team_member").select("team_id, player_id"),
  ]);

  const membersByTeam = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(m.player_id);
    membersByTeam.set(m.team_id, list);
  }

  const engineTeams = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    memberIds: membersByTeam.get(t.id) ?? [],
    expectedSize: division?.team_size ?? 2,
  }));
  const engineplayers = (players ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim() }));

  const issues = validateTeams(engineplayers, engineTeams);
  const blocking = issues.filter((i) => i.severity === "blocking");
  const warnings = issues.filter((i) => i.severity === "warning");
  const canLock = tournament.status === "draft" && blocking.length === 0 && engineTeams.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Card title="Validation">
        {issues.length === 0 ? (
          <p className="text-sm text-[var(--color-success)]">Everything checks out — no issues found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {blocking.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-error)]">
                  Must fix before locking
                </p>
                {blocking.map((issue, i) => (
                  <p key={i} className="rounded-lg border border-[var(--color-error)] bg-red-50 px-3 py-2 text-sm text-[var(--color-error)]">
                    {issue.message}
                  </p>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Warnings</p>
                {warnings.map((issue, i) => (
                  <p key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                    {issue.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Lock tournament">
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Locking finalizes players and teams. {tournament.status !== "draft" && "This tournament is already locked."}
        </p>
        <form action={lockTournament.bind(null, slug)}>
          <Button type="submit" fullWidth size="lg" disabled={!canLock}>
            {tournament.status === "draft" ? "Lock tournament" : `Status: ${tournament.status}`}
          </Button>
        </form>
      </Card>
    </div>
  );
}
