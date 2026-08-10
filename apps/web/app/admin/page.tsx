import Link from "next/link";
import { getSession } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase-server";
import { PasscodeForm } from "./PasscodeForm";
import { createTournament, signOutOrganizer } from "./actions";
import { DeleteTournamentButton } from "./DeleteTournamentButton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function AdminHomePage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-navy)] p-6">
        <PasscodeForm />
      </main>
    );
  }

  const supabase = getServiceSupabase();
  const [{ data: tournaments }, { data: templates }] = await Promise.all([
    supabase
      .from("tournament")
      .select("id, name, slug, status, date_start, venue")
      .order("created_at", { ascending: false }),
    supabase.from("tournament_template").select("id, name, description").order("name"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            Tournament platform
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-black uppercase text-[var(--color-navy)]">
            Tournaments
          </h1>
        </div>
        <form action={signOutOrganizer}>
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </header>

      <Card title="+ New tournament">
        <form action={createTournament} className="flex flex-col gap-4">
          <Input label="Tournament name" name="name" required placeholder="2nd Pakangers Exclusive Tournament" />
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-[var(--color-navy)]">Start from</span>
            <select
              name="templateId"
              className="w-full rounded-lg border-2 border-[var(--border-subtle)] bg-white px-4 py-3 text-base"
              defaultValue=""
            >
              <option value="">Blank tournament</option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Create tournament</Button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        {tournaments?.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">No tournaments yet — create the first one above.</p>
        )}
        {tournaments?.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-4 rounded-2xl border-t-4 border-[var(--color-gold)] bg-white p-4 shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)]"
          >
            <Link href={`/admin/${t.slug}`} className="flex-1">
              <div className="font-semibold text-[var(--color-navy)]">{t.name}</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {t.venue ?? "Venue TBD"} {t.date_start ? `· ${t.date_start}` : ""}
              </div>
            </Link>
            <Badge tone={t.status === "draft" ? "neutral" : t.status === "completed" ? "success" : "gold"}>
              {t.status.replace("_", " ")}
            </Badge>
            <DeleteTournamentButton tournamentId={t.id} name={t.name} />
          </div>
        ))}
      </div>
    </main>
  );
}
