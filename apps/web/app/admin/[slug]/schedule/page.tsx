import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getScheduleView, type ScheduleRow } from "@/lib/schedule-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TeamMatchup } from "@/components/TeamMatchup";
import {
  addCourt,
  assignMatchToCourt,
  autoAssignSchedule,
  clearSchedule,
  moveMatch,
  removeCourt,
  renameCourt,
  setCourtAvailability,
  setMinRestRounds,
} from "./actions";

/** Conflicts render on the offending match, in plain language -- never as a count at the top (A8). */
function MatchIssues({ row }: { row: ScheduleRow }) {
  if (row.issues.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {row.issues.map((issue, i) => (
        <p
          key={i}
          className={`rounded px-2 py-1 text-xs ${
            issue.severity === "blocking"
              ? "bg-red-50 text-[var(--color-error)]"
              : "bg-[var(--surface-sunken)] text-[var(--color-text-muted)]"
          }`}
        >
          {issue.message}
        </p>
      ))}
    </div>
  );
}

function MatchLine({ slug, row, canMove }: { slug: string; row: ScheduleRow; canMove: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            M{row.matchNumber} · {row.groupName ? `${row.stageName} · ${row.groupName}` : row.stageName}
            {row.round !== null && ` · Round ${row.round + 1}`}
          </span>
          <TeamMatchup home={row.home} away={row.away} />
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {row.isResolved ? (
            <Badge tone="success">played</Badge>
          ) : (
            <>
              {canMove && (
                <div className="flex gap-1">
                  <form action={moveMatch.bind(null, slug, row.matchId, "up")}>
                    <Button type="submit" variant="outline" size="sm" aria-label="Move earlier">
                      ↑
                    </Button>
                  </form>
                  <form action={moveMatch.bind(null, slug, row.matchId, "down")}>
                    <Button type="submit" variant="outline" size="sm" aria-label="Move later">
                      ↓
                    </Button>
                  </form>
                </div>
              )}
              <form action={assignMatchToCourt.bind(null, slug, row.matchId, null)}>
                <Button type="submit" variant="outline" size="sm">
                  Unassign
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
      <MatchIssues row={row} />
    </div>
  );
}

export default async function SchedulePage({ params }: PageProps<"/admin/[slug]/schedule">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const { courts, rows, options, generalIssues } = await getScheduleView(tournament.id, tournament.schedule_config);

  const unscheduled = rows.filter((r) => r.courtId === null);
  const byCourt = new Map(courts.map((c) => [c.id, rows.filter((r) => r.courtId === c.id)]));
  const blockingCount = rows.reduce((n, r) => n + r.issues.filter((i) => i.severity === "blocking").length, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Dashboard
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-[var(--color-navy)]">
          Schedule
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Each court runs its own queue. Everything in Round 1 goes on together, then Round 2, and so on — no fixed
          clock times, so you can just call the next match as a court frees up.
        </p>
      </header>

      {rows.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">
            No matches yet. Start the tournament from the dashboard first — matches have to exist before they can be
            scheduled.
          </p>
        </Card>
      )}

      <Card title="Courts">
        <div className="flex flex-col gap-2">
          {courts.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">No courts yet — add the first one below.</p>
          )}
          {courts.map((court) => (
            <div
              key={court.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] p-2"
            >
              <form action={renameCourt.bind(null, slug, court.id)} className="flex min-w-0 flex-1 basis-full items-center gap-2">
                <input
                  name="name"
                  defaultValue={court.name}
                  aria-label="Court name"
                  className="min-w-0 flex-1 rounded border-2 border-[var(--border-subtle)] bg-white px-2 py-1.5 text-sm"
                />
                <Button type="submit" variant="outline" size="sm">
                  Rename
                </Button>
              </form>
              <form action={setCourtAvailability.bind(null, slug, court.id, !court.isAvailable)} className="flex-1">
                <Button type="submit" variant={court.isAvailable ? "outline" : "secondary"} size="sm" fullWidth>
                  {court.isAvailable ? "Available" : "Unavailable"}
                </Button>
              </form>
              <form action={removeCourt.bind(null, slug, court.id)} className="flex-1">
                <Button type="submit" variant="outline" size="sm" fullWidth>
                  Remove
                </Button>
              </form>
            </div>
          ))}
        </div>

        <form action={addCourt.bind(null, slug)} className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Input label="Add a court" name="name" placeholder="Court 1" required />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card title="Auto-assign">
        <form action={setMinRestRounds.bind(null, slug)} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Rounds of rest between a team's matches"
              name="minRestRounds"
              type="number"
              min={0}
              defaultValue={options.minRestRounds}
            />
          </div>
          <Button type="submit" variant="outline">
            Save
          </Button>
        </form>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          0 lets a team play back-to-back. 1 gives every team at least one round off between matches.
        </p>
        <div className="mt-3 flex gap-2">
          <form action={autoAssignSchedule.bind(null, slug)} className="flex-1">
            <Button type="submit" fullWidth disabled={courts.length === 0}>
              Auto-assign all matches
            </Button>
          </form>
          <form action={clearSchedule.bind(null, slug)}>
            <Button type="submit" variant="outline">
              Clear
            </Button>
          </form>
        </div>
        {courts.length === 0 && (
          <p className="mt-2 text-xs text-[var(--color-error)]">Add at least one court before auto-assigning.</p>
        )}
        {blockingCount === 0 && rows.some((r) => r.courtId !== null) && (
          <p className="mt-3 text-sm text-[var(--color-success)]">No scheduling conflicts.</p>
        )}
        {generalIssues.map((issue, i) => (
          <p key={i} className="mt-2 text-sm text-[var(--color-error)]">
            {issue.message}
          </p>
        ))}
      </Card>

      {courts.map((court) => {
        const queue = byCourt.get(court.id) ?? [];
        return (
          <Card key={court.id} title={court.name}>
            {!court.isAvailable && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-error)]">
                Marked unavailable
              </p>
            )}
            {queue.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Nothing scheduled on this court.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {queue.map((row) => (
                  <MatchLine key={row.matchId} slug={slug} row={row} canMove={queue.length > 1} />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {unscheduled.length > 0 && (
        <Card title={`Not scheduled (${unscheduled.length})`}>
          <div className="flex flex-col gap-2">
            {unscheduled.map((row) => (
              <div key={row.matchId} className="rounded-lg border border-[var(--border-subtle)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                      M{row.matchNumber} · {row.groupName ? `${row.stageName} · ${row.groupName}` : row.stageName}
                    </span>
                    <TeamMatchup home={row.home} away={row.away} />
                  </div>
                  {row.isResolved ? (
                    <Badge tone="success">played</Badge>
                  ) : (
                    <div className="flex flex-none flex-col gap-1">
                      {courts
                        .filter((c) => c.isAvailable)
                        .map((court) => (
                          <form key={court.id} action={assignMatchToCourt.bind(null, slug, row.matchId, court.id)}>
                            <Button type="submit" variant="outline" size="sm" fullWidth>
                              → {court.name}
                            </Button>
                          </form>
                        ))}
                    </div>
                  )}
                </div>
                <MatchIssues row={row} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
