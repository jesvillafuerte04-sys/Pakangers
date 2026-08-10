import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug, getSetupProgress } from "@/lib/tournament-data";
import { getMatchProgress } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { startTournament } from "./matches/actions";

const STATUS_TONE: Record<string, "neutral" | "gold" | "success"> = {
  draft: "neutral",
  registration: "gold",
  locked: "gold",
  in_progress: "gold",
  completed: "success",
  archived: "neutral",
};

export default async function TournamentDashboardPage({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const progress = await getSetupProgress(tournament.id);
  const matchProgress =
    tournament.status === "in_progress" || tournament.status === "completed"
      ? await getMatchProgress(tournament.id)
      : null;

  const checklist = [
    { label: "Tournament info", done: Boolean(tournament.venue && tournament.date_start), href: `/admin/${slug}/setup/info` },
    { label: `Players (${progress.playerCount})`, done: progress.playerCount > 0, href: `/admin/${slug}/setup/players` },
    { label: `Teams (${progress.teamCount})`, done: progress.teamCount > 0, href: `/admin/${slug}/setup/teams` },
    {
      label: `Groups (${progress.teamsAssigned}/${progress.teamsTotal} assigned)`,
      done: progress.teamsTotal > 0 && progress.teamsAssigned === progress.teamsTotal,
      href: `/admin/${slug}/setup/groups`,
    },
    { label: "Stages & scoring", done: true, href: `/admin/${slug}/setup/stages` },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href="/admin" className="text-sm font-medium text-[var(--color-navy)]">
        ← All tournaments
      </Link>

      <header className="flex flex-col gap-2">
        <Badge tone={STATUS_TONE[tournament.status] ?? "neutral"}>{tournament.status.replace("_", " ")}</Badge>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-black uppercase text-[var(--color-navy)]">
          {tournament.name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {tournament.venue ?? "Venue not set"} {tournament.date_start ? `· ${tournament.date_start}` : ""}
        </p>
      </header>

      {tournament.status === "draft" && (
        <Card title="Setup checklist">
          <div className="flex flex-col gap-2">
            {checklist.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-4 py-3 hover:bg-[var(--surface-sunken)]"
              >
                <span className="font-medium text-[var(--color-navy)]">{item.label}</span>
                <span>{item.done ? "✓" : "○"}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Link href={`/admin/${slug}/setup/review`}>
              <Button fullWidth>Review & lock</Button>
            </Link>
          </div>
        </Card>
      )}

      {tournament.status === "locked" && (
        <Card title="Ready to start">
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            Setup is complete and teams are locked in. Starting the tournament generates every pool match.
          </p>
          <form action={startTournament.bind(null, slug)}>
            <Button type="submit" fullWidth size="lg">
              Start tournament
            </Button>
          </form>
        </Card>
      )}

      {(tournament.status === "in_progress" || tournament.status === "completed") && (
        <Card title={tournament.status === "completed" ? "Tournament complete" : "In progress"}>
          <p className="text-sm text-[var(--color-text-muted)]">
            {matchProgress?.completed ?? 0} of {matchProgress?.total ?? 0} matches complete
          </p>
          <div className="mt-4">
            <Link href={`/admin/${slug}/matches`}>
              <Button fullWidth>Go to matches</Button>
            </Link>
          </div>
        </Card>
      )}
    </main>
  );
}
