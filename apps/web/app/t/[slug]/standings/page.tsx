import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getDisplayStandings } from "@/lib/match-pipeline";
import { Card } from "@/components/ui/Card";
import { TeamLine } from "@/components/TeamMatchup";
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
          <ol className="flex flex-col">
            {g.standings.map((s, i) => (
              <li key={s.entrantId}>
                <div className="flex items-start gap-2 py-2">
                  <span className="w-5 pt-0.5 text-sm font-bold text-[var(--color-text-muted)]">{s.rank}</span>
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <div>
                      <TeamLine display={s.team} />
                      {s.unresolvedTie && <span className="text-xs text-[var(--color-text-muted)]">(tied)</span>}
                    </div>
                    <span className="whitespace-nowrap text-right text-sm text-[var(--color-text-muted)]">
                      {s.wins}-{s.losses} · {s.pointDifferential >= 0 ? "+" : ""}
                      {s.pointDifferential} diff · {s.pointsFor} pts
                    </span>
                  </div>
                </div>
                {g.qualifyCount !== null && i === g.qualifyCount - 1 && i < g.standings.length - 1 && (
                  <div className="my-1 border-t-2 border-dashed border-[var(--color-gold)]" />
                )}
              </li>
            ))}
          </ol>
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
