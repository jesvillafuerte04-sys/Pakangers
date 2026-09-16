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
            {results.firstRunnerUp && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">1st Runner-up</span>
                <TeamLine display={results.firstRunnerUp} className="text-right" />
              </div>
            )}
            {results.secondRunnerUp && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">2nd Runner-up</span>
                <TeamLine display={results.secondRunnerUp} className="text-right" />
              </div>
            )}
            {results.thirdRunnerUp && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-semibold text-[var(--color-text-muted)]">3rd Runner-up</span>
                <TeamLine display={results.thirdRunnerUp} className="text-right" />
              </div>
            )}
          </div>
        </Card>

        {results.standings.map((g) => (
          <Card
            key={`${g.stageKey}:${g.groupName}`}
            title={`${g.groupName.startsWith("Bracket") ? g.groupName : `Bracket ${g.groupName}`} — final standings`}
          >
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
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[var(--color-navy)] flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-gold)] animate-pulse" />
              Live Now ({snapshot.live.length})
            </h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {snapshot.live.map((m) => (
              <Card key={m.id} className="border-l-4 border-l-[var(--color-gold)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <TeamMatchup home={m.home} away={m.away} />
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge tone="gold">Live</Badge>
                    <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                      M{m.matchNumber} · {m.groupName ? (m.groupName.startsWith("Bracket") ? m.groupName : `Bracket ${m.groupName}`) : m.stageName}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[var(--color-navy)]">
            Up Next
          </h2>
          <Link href={`/t/${slug}/matches`} className="text-xs font-semibold text-[var(--color-navy)] hover:underline">
            All Matches →
          </Link>
        </div>
        {snapshot.upcoming.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">No upcoming matches right now.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {snapshot.upcoming.map((m) => (
              <Card key={m.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <TeamMatchup home={m.home} away={m.away} />
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block rounded-md bg-[var(--surface-sunken)] px-2 py-1 text-xs font-semibold text-[var(--color-navy)]">
                      M{m.matchNumber}
                    </span>
                    <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                      {m.groupName ? (m.groupName.startsWith("Bracket") ? m.groupName : `Bracket ${m.groupName}`) : m.stageName}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {snapshot.standingsSnippet.length > 0 && (
        <Card title="Standings Leaders">
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {snapshot.standingsSnippet.map((s) => {
              const bracketLabel = s.groupName.startsWith("Bracket") ? s.groupName : `Bracket ${s.groupName}`;
              return (
                <div key={`${s.stageName}:${s.groupName}`} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
                      {bracketLabel}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Top {s.qualifyCount} Advance
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {s.topTeams.map((t) => (
                      <div key={t.rank} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-[10px] font-bold text-white">
                            {t.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <TeamLine display={t.team} />
                          </div>
                        </div>
                        <span className="whitespace-nowrap text-xs font-bold text-[var(--color-navy)] shrink-0">
                          {t.record}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Link href={`/t/${slug}/standings`} className="mt-3 block text-sm font-semibold text-[var(--color-navy)] hover:underline">
            View full standings table →
          </Link>
        </Card>
      )}
    </div>
  );
}
