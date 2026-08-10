import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTournament, getLandingSnapshot, getFinalResults } from "@/lib/public-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TeamLine, TeamMatchup } from "@/components/TeamMatchup";

export default async function PublicLandingPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  if (tournament.status === "completed") {
    const results = await getFinalResults(tournament.id);
    return (
      <div className="flex flex-col gap-6">
        <Card title="Final results">
          <div className="flex flex-col gap-3">
            {results.champion && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-gold)] px-4 py-3">
                <span className="font-bold uppercase text-[var(--color-navy)]">🏆 Champion</span>
                <TeamLine display={results.champion} className="text-right" />
              </div>
            )}
            {results.runnerUp && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">Runner-up</span>
                <TeamLine display={results.runnerUp} className="text-right" />
              </div>
            )}
            {results.thirdPlace && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">Third place</span>
                <TeamLine display={results.thirdPlace} className="text-right" />
              </div>
            )}
          </div>
        </Card>

        {results.standings.map((g) => (
          <Card key={`${g.stageKey}:${g.groupName}`} title={`${g.stageName} — ${g.groupName} — final standings`}>
            <ol className="flex flex-col gap-1">
              {g.standings.map((s) => (
                <li key={s.entrantId} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex gap-1.5">
                    <span>{s.rank}.</span>
                    <TeamLine display={s.team} />
                  </div>
                  <span className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {s.wins}-{s.losses}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        ))}

        <Link href={`/t/${slug}/matches`} className="text-center text-sm font-medium text-[var(--color-navy)] underline">
          View full match archive
        </Link>
      </div>
    );
  }

  const snapshot = await getLandingSnapshot(tournament.id);

  return (
    <div className="flex flex-col gap-6">
      {snapshot.live.length > 0 && (
        <Card title="Live now">
          <div className="flex flex-col gap-3">
            {snapshot.live.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3">
                <TeamMatchup home={m.home} away={m.away} />
                <Badge tone="gold">Live</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Up next">
        {snapshot.upcoming.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No upcoming matches right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {snapshot.upcoming.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3">
                <TeamMatchup home={m.home} away={m.away} />
                <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                  {m.stageName} {m.groupName ? `· ${m.groupName}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href={`/t/${slug}/matches`} className="mt-3 block text-sm font-medium text-[var(--color-navy)] underline">
          See all matches
        </Link>
      </Card>

      {snapshot.standingsSnippet.length > 0 && (
        <Card title="Standings">
          <div className="flex flex-col gap-2">
            {snapshot.standingsSnippet.map((s) => (
              <div key={`${s.stageName}:${s.groupName}`} className="flex items-start justify-between gap-3 text-sm">
                <span className="whitespace-nowrap text-[var(--color-text-muted)]">{s.groupName} leads</span>
                <TeamLine display={s.topTeam} className="text-right" />
                <span className="whitespace-nowrap text-[var(--color-text-muted)]">({s.topTeamRecord})</span>
              </div>
            ))}
          </div>
          <Link href={`/t/${slug}/standings`} className="mt-3 block text-sm font-medium text-[var(--color-navy)] underline">
            Full standings
          </Link>
        </Card>
      )}
    </div>
  );
}
