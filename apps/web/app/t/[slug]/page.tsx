import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTournament, getLandingSnapshot, getFinalResults } from "@/lib/public-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-gold)] px-4 py-3">
                <span className="font-bold uppercase text-[var(--color-navy)]">🏆 Champion</span>
                <span className="font-bold text-[var(--color-navy)]">{results.champion}</span>
              </div>
            )}
            {results.runnerUp && (
              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">Runner-up</span>
                <span className="font-semibold">{results.runnerUp}</span>
              </div>
            )}
            {results.thirdPlace && (
              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">Third place</span>
                <span className="font-semibold">{results.thirdPlace}</span>
              </div>
            )}
          </div>
        </Card>

        {results.standings.map((g) => (
          <Card key={`${g.stageKey}:${g.groupName}`} title={`${g.stageName} — ${g.groupName} — final standings`}>
            <ol className="flex flex-col gap-1">
              {g.standings.map((s) => (
                <li key={s.entrantId} className="flex justify-between text-sm">
                  <span>
                    {s.rank}. {s.teamName}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
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
          <div className="flex flex-col gap-2">
            {snapshot.live.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {m.homeTeamName} vs {m.awayTeamName}
                </span>
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
          <div className="flex flex-col gap-2">
            {snapshot.upcoming.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {m.homeTeamName} vs {m.awayTeamName}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
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
              <div key={`${s.stageName}:${s.groupName}`} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">{s.groupName} leads</span>
                <span className="font-medium">
                  {s.topTeamName} ({s.topTeamRecord})
                </span>
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
