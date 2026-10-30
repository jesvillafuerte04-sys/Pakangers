import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getDisplayStandings } from "@/lib/match-pipeline";
import { Card } from "@/components/ui/Card";
import { StandingsRow } from "@/components/StandingsRow";
import type { Tiebreaker } from "@pakangers/engine";
import { bracketLabel } from "@/lib/match-identity";

const TIEBREAKER_LABEL: Record<Tiebreaker, string> = {
  match_wins: "match wins",
  win_percentage: "win percentage",
  head_to_head: "head-to-head",
  head_to_head_point_differential: "head-to-head point differential",
  point_differential: "point differential",
  points_scored: "points scored",
  points_allowed: "points allowed",
  games_won: "games won",
  coin_flip: "coin toss",
};

function formatTiebreakerNote(tiebreakers: Tiebreaker[]): string {
  if (tiebreakers.length === 0) return "";
  const labels = tiebreakers.map((tb) => TIEBREAKER_LABEL[tb] ?? tb);
  if (labels.length === 1) {
    return `Ties are broken by: ${labels[0]}.`;
  }
  const allButLast = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return `Ties are broken by: ${allButLast}, then ${last}.`;
}

/**
 * Whether an unbreakable tie is worth a coin toss.
 *
 * Only ties that reach the advancing line matter: inside the top N it decides
 * the seeding into the knockout, and one place below it decides who gets in
 * at all. A tie for 4th and 5th in a bracket where two advance changes
 * nothing, so flagging it just asks the organizer to toss a coin for nothing.
 */
function reachesTheLine(index: number, qualifyCount: number | null): boolean {
  return qualifyCount !== null && index <= qualifyCount;
}

function formatGroupHeading(groupName: string): string {
  return bracketLabel(groupName, null) ?? groupName;
}

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
      {groups.map((g) => {
        // Nothing is decided until every match in the bracket has been played:
        // a team sitting first at the halfway point has not qualified, and an
        // unplayed bracket is nothing but ties. So the advancing highlight,
        // the outcome note and the coin-toss flag all wait for this.
        const settled = g.isComplete;
        return (
          <Card key={`${g.stageKey}:${g.groupName}`}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[var(--color-navy)]">
                {formatGroupHeading(g.groupName)}
              </h3>
              {g.qualifyCount !== null && (
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    settled
                      ? "bg-[var(--color-gold)] text-[var(--color-navy)]"
                      : "bg-[var(--surface-sunken)] text-[var(--color-text-muted)]"
                  }`}
                >
                  Top {g.qualifyCount} advance{settled ? "" : " · bracket in progress"}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {g.standings.map((s, i) => (
                <div key={s.entrantId}>
                  <StandingsRow
                    rank={s.rank}
                    team={s.team}
                    needsCoinToss={settled && s.unresolvedTie && reachesTheLine(i, g.qualifyCount)}
                    isQualifying={settled && g.qualifyCount !== null && i < g.qualifyCount}
                    advancementReason={s.advancementReason}
                    outcomeNote={s.outcomeNote}
                    wins={s.wins}
                    losses={s.losses}
                    pointDifferential={s.pointDifferential}
                    pointsFor={s.pointsFor}
                    stats={s.stats}
                    history={s.history}
                  />
                  {settled && g.qualifyCount !== null && i === g.qualifyCount - 1 && i < g.standings.length - 1 && (
                    <div className="my-2 flex items-center gap-2">
                      <div className="h-0 flex-1 border-t-2 border-dashed border-[var(--color-error)]" />
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-[var(--color-error)]">
                        Eliminated teams below
                      </span>
                      <div className="h-0 flex-1 border-t-2 border-dashed border-[var(--color-error)]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          {g.tiebreakers.length > 0 && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              {formatTiebreakerNote(g.tiebreakers)}
            </p>
          )}
          </Card>
        );
      })}
    </div>
  );
}
