import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getMatchList, type MatchListFilter } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const TABS: { key: MatchListFilter; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

const STATUS_TONE: Record<string, "neutral" | "gold" | "success"> = {
  pending: "neutral",
  scheduled: "neutral",
  in_progress: "gold",
  completed: "success",
  forfeit: "success",
  bye: "neutral",
};

export default async function PublicMatchesPage({
  params,
  searchParams,
}: PageProps<"/t/[slug]/matches">) {
  const { slug } = await params;
  const sp = await searchParams;
  const filter = (typeof sp.filter === "string" ? sp.filter : "live") as MatchListFilter;

  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  const matches = await getMatchList(tournament.id, filter);
  const byStage = new Map<string, typeof matches>();
  for (const m of matches) {
    const list = byStage.get(m.stageName) ?? [];
    list.push(m);
    byStage.set(m.stageName, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/t/${slug}/matches?filter=${tab.key}`}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${
              filter === tab.key
                ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-gold)]"
                : "border-[var(--color-navy)] text-[var(--color-navy)]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {matches.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">No matches in this view yet.</p>
        </Card>
      )}

      {[...byStage.entries()].map(([stageName, stageMatches]) => (
        <div key={stageName} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{stageName}</h2>
          {stageMatches.map((m) => (
            <Card key={m.id} className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Match #{m.matchNumber} {m.groupName ? `· ${m.groupName}` : ""}
                </span>
                <span className="font-medium text-[var(--color-navy)]">
                  {m.homeTeamName} vs {m.awayTeamName}
                </span>
                {m.homePointsTotal !== null && (
                  <span className="text-lg font-bold text-[var(--color-navy)]">
                    {m.homePointsTotal}–{m.awayPointsTotal}
                  </span>
                )}
              </div>
              <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status === "in_progress" ? "Live" : m.status.replace("_", " ")}</Badge>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
