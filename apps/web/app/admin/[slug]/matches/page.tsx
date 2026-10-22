import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getMatchList, getTournamentCourts, type MatchListFilter } from "@/lib/match-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { markMatchLive } from "./actions";
import { MatchCardBody } from "@/components/MatchCard";

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

  const [matches, courts] = await Promise.all([
    getMatchList(tournament.id, filter),
    getTournamentCourts(tournament.id),
  ]);
  const openCourts = courts.filter((c) => c.isAvailable);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-[var(--color-navy)]">
          Matches
        </h1>
        <Link href={`/admin/${slug}/schedule`}>
          <Button variant="outline" size="sm">
            📅 Courts & schedule
          </Button>
        </Link>
      </div>

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

      {matches.map((m) => {
        const cleanLabel = m.matchLabel ?? (m.groupName ? (m.groupName.startsWith("Pool") ? m.groupName : `Pool ${m.groupName.replace(/^(Bracket|Pool|Group)\s*/i, "")}`) : m.stageName);

        return (
          <Card key={m.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {m.fullBadgeText ?? `M${m.matchNumber} · ${cleanLabel}`}
                {m.courtName && ` · ${m.courtName}`}
                {m.round !== null && ` · Round ${m.round + 1}`}
              </span>
              <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status.replace("_", " ")}</Badge>
            </div>

          <Link href={`/admin/${slug}/matches/${m.id}`} className="block">
            <MatchCardBody match={m} />
          </Link>

          <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-2">
            <Link href={`/admin/${slug}/matches/${m.id}`} className="flex-1">
              <Button variant="outline" size="sm" fullWidth>
                {m.winnerSide ? "Correct score" : "Enter score"}
              </Button>
            </Link>
            {m.status === "pending" &&
              (openCourts.length === 0 ? (
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Add a court first
                </span>
              ) : (
                <form action={markMatchLive.bind(null, slug, m.id)} className="flex items-center gap-2">
                  <select
                    name="courtId"
                    required
                    defaultValue={m.courtId ?? ""}
                    aria-label={`Court for match ${m.matchNumber}`}
                    className="rounded-lg border-2 border-[var(--color-navy)] px-2 py-1.5 text-sm font-semibold text-[var(--color-navy)]"
                  >
                    <option value="">Court…</option>
                    {openCourts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" size="sm">
                    Mark live
                  </Button>
                </form>
              ))}
          </div>
        </Card>
      );
    })}
    </main>
  );
}
