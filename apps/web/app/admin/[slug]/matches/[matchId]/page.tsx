import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getMatchDetail } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { ScoreEntryForm } from "./ScoreEntryForm";

function scoringDescription(cfg: { pointsToWin: number; winBy: string; bestOf: number; cap?: number }): string {
  const winBy = cfg.winBy === "win_by_two" ? "win by 2" : "sudden death";
  const capText = cfg.cap ? `, capped at ${cfg.cap}` : "";
  const bestOfText = cfg.bestOf > 1 ? `, best of ${cfg.bestOf}` : "";
  return `First to ${cfg.pointsToWin}, ${winBy}${capText}${bestOfText}`;
}

export default async function ScoreEntryPage({ params }: PageProps<"/admin/[slug]/matches/[matchId]">) {
  const { slug, matchId } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const match = await getMatchDetail(matchId);
  if (!match) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}/matches`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Match list
      </Link>

      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Match #{match.matchNumber} {match.groupName ? `· ${match.groupName}` : `· ${match.stageName}`}
        </p>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{scoringDescription(match.scoringConfig)}</p>

        {match.priorResult && (
          <p className="mb-4 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
            Previously recorded by {match.priorResult.recordedBy} at{" "}
            {new Date(match.priorResult.recordedAt).toLocaleString()}
            {match.priorResult.resultType !== "normal" ? ` (${match.priorResult.resultType})` : ""}.
          </p>
        )}

        <ScoreEntryForm slug={slug} match={match} />
      </Card>
    </main>
  );
}
