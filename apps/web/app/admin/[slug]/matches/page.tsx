import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getMatchList, type MatchListFilter } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { markMatchLive } from "./actions";
import { TeamMatchup } from "@/components/TeamMatchup";

const TABS: { key: MatchListFilter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
];

const STATUS_TONE: Record<string, "neutral" | "gold" | "success" | "navy"> = {
  pending: "neutral",
  scheduled: "neutral",
  in_progress: "gold",
  completed: "success",
  forfeit: "success",
  bye: "neutral",
};

export default async function MatchListPage({
  params,
  searchParams,
}: PageProps<"/admin/[slug]/matches">) {
  const { slug } = await params;
  const sp = await searchParams;
  const filter = (typeof sp.filter === "string" ? sp.filter : "upcoming") as MatchListFilter;

  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const matches = await getMatchList(tournament.id, filter);
  const byStage = new Map<string, typeof matches>();
  for (const m of matches) {
    const list = byStage.get(m.stageName) ?? [];
    list.push(m);
    byStage.set(m.stageName, list);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Dashboard
      </Link>

      <h1 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-[var(--color-navy)]">
        Matches
      </h1>

      <nav className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/${slug}/matches?filter=${tab.key}`}
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
              <Link href={`/admin/${slug}/matches/${m.id}`} className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Match #{m.matchNumber} {m.groupName ? `· ${m.groupName}` : ""}
                </span>
                <TeamMatchup home={m.home} away={m.away} />
                {m.homePointsTotal !== null && (
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {m.homePointsTotal}–{m.awayPointsTotal} {m.resultType && m.resultType !== "normal" ? `(${m.resultType})` : ""}
                  </span>
                )}
              </Link>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status.replace("_", " ")}</Badge>
                {m.status === "pending" && (
                  <form action={markMatchLive.bind(null, slug, m.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Mark live
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      ))}
    </main>
  );
}
