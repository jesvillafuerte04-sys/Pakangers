import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getDisplayStandings } from "@/lib/match-pipeline";
import { Card } from "@/components/ui/Card";
import { StandingsRow } from "@/components/StandingsRow";
import type { Tiebreaker } from "@pakangers/engine";

const TIEBREAKER_LABEL: Record<Tiebreaker, string> = {
  match_wins: "match wins",
  win_percentage: "win percentage",
  head_to_head: "head-to-head",
  point_differential: "point differential",
  points_scored: "points scored",
  points_allowed: "points allowed",
  games_won: "games won",
  coin_flip: "organizer decision",
};

export default async function PublicStandingsPage({ params }: PageProps<"/t/[slug]/standings">) {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  const groups = await getDisplayStandings(tournament.id);

  if (groups.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-muted)]">Standings will appear once pool play starts.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <Card key={`${g.stageKey}:${g.groupName}`} title={`${g.stageName} — ${g.groupName}`}>
          <div className="flex flex-col gap-1">
            {g.standings.map((s, i) => (
              <div key={s.entrantId}>
                <StandingsRow
                  rank={s.rank}
                  team={s.team}
                  unresolvedTie={s.unresolvedTie}
                  isQualifying={g.qualifyCount !== null && i < g.qualifyCount}
                  wins={s.wins}
                  losses={s.losses}
                  pointDifferential={s.pointDifferential}
                  pointsFor={s.pointsFor}
                  stats={s.stats}
                  history={s.history}
                />
                {g.qualifyCount !== null && i === g.qualifyCount - 1 && i < g.standings.length - 1 && (
                  <div className="my-1 border-t-2 border-dashed border-[var(--color-gold)]" />
                )}
              </div>
            ))}
          </div>
          {g.tiebreakers.length > 0 && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Ties broken by: {g.tiebreakers.map((tb) => TIEBREAKER_LABEL[tb]).join(", then ")}.
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
