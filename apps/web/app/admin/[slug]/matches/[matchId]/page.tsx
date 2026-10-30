import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getMatchDetail } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { ScoreEntryForm } from "./ScoreEntryForm";

/**
 * A recorded-at time in the tournament's own timezone.
 *
 * toLocaleString() uses whatever zone the machine rendering the page is in --
 * on Vercel that is UTC, so a Manila event showed times eight hours out.
 */
function formatInVenueTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function scoringDescription(cfg: { pointsToWin: number; winBy: string; bestOf: number; cap?: number }): string {
  const winBy = cfg.winBy === "win_by_two" ? "win by 2" : "sudden death";
  const capText = cfg.cap ? `, capped at ${cfg.cap}` : "";
  const bestOfText = cfg.bestOf > 1 ? `, best of ${cfg.bestOf}` : "";
  return `First to ${cfg.pointsToWin}, ${winBy}${capText}${bestOfText}`;
}

const LIST_TABS = ["upcoming", "live", "completed"];

export default async function ScoreEntryPage({
  params,
  searchParams,
}: PageProps<"/admin/[slug]/matches/[matchId]">) {
  const { slug, matchId } = await params;
  const sp = await searchParams;
  // Which tab to come back to. "live" is the fallback rather than "upcoming",
  // because a match being scored was, by definition, live a moment ago.
  const from = typeof sp.from === "string" && LIST_TABS.includes(sp.from) ? sp.from : "live";
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const match = await getMatchDetail(matchId);
  if (!match) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}/matches?filter=${from}`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Match list
      </Link>

      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          {match.fullBadgeText ?? `Match #${match.matchNumber} · ${match.matchLabel ?? match.stageName}`}
        </p>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{scoringDescription(match.scoringConfig)}</p>

        {match.priorResult && (
          <p className="mb-4 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
            Previously recorded by {match.priorResult.recordedBy} at{" "}
            {formatInVenueTime(match.priorResult.recordedAt, match.timezone)}
            {match.priorResult.resultType !== "normal" ? ` (${match.priorResult.resultType})` : ""}.
          </p>
        )}

        {match.status === "pending" ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            This match has not started. Go back to the match list, choose its court and press
            <strong> Mark live</strong> — then the score can be entered.
          </p>
        ) : (
          <ScoreEntryForm slug={slug} match={match} returnFilter={from} />
        )}
      </Card>
    </main>
  );
}
