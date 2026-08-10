import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getMatchList, type MatchListFilter } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MatchCardBody } from "@/components/MatchCard";

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

      {matches.map((m) => (
        <Card key={m.id}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
              M{m.matchNumber} · {m.groupName ? `${m.stageName} · ${m.groupName}` : m.stageName}
              {m.courtName && ` · ${m.courtName}`}
              {m.round !== null && ` · Round ${m.round + 1}`}
            </span>
            <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>
              {m.status === "in_progress" ? "Live" : m.status.replace("_", " ")}
            </Badge>
          </div>
          <MatchCardBody match={m} />
        </Card>
      ))}
    </div>
  );
}
