import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  addTournamentRule,
  moveTournamentRule,
  removeTournamentRule,
  setTournamentRuleSet,
  updateTournamentRule,
} from "./actions";

const CATEGORIES = ["scoring", "serving", "faults", "timeouts", "conduct", "general"];

export default async function RulesPage({ params }: PageProps<"/admin/[slug]/rules">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const supabase = getServiceSupabase();
  const [{ data: ruleSets }, { data: rules }] = await Promise.all([
    supabase.from("rule_set").select("id, name, edition_year, source_url").order("edition_year", { ascending: false }),
    supabase
      .from("tournament_rule")
      .select("id, category, title, summary_text, source_ref, display_order")
      .eq("tournament_id", tournament.id)
      .order("display_order"),
  ]);

  const selectedRuleSet = (ruleSets ?? []).find((rs) => rs.id === tournament.rule_set_id) ?? null;
  const ruleList = rules ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Dashboard
      </Link>

      <h1 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-[var(--color-navy)]">
        Rules
      </h1>

      <Card title="Official rule set">
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">
          Which published rulebook this tournament runs under. Players see the name and a link to the official source
          on the public Info tab.
        </p>
        <form action={setTournamentRuleSet.bind(null, slug)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-[var(--color-navy)]">Rule set</span>
            <select
              name="ruleSetId"
              defaultValue={tournament.rule_set_id ?? ""}
              className="w-full rounded-lg border-2 border-[var(--border-subtle)] bg-white px-4 py-3 text-base"
            >
              <option value="">None selected</option>
              {(ruleSets ?? []).map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline">
            Save rule set
          </Button>
        </form>
        {selectedRuleSet && (
          <a
            href={selectedRuleSet.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-[var(--color-navy)] underline"
          >
            {selectedRuleSet.source_url} ↗
          </a>
        )}
      </Card>

      <Card title={`Tournament rules (${ruleList.length})`}>
        <p className="mb-4 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          Write your own short summaries and link to the official source. Never paste rulebook text — the USA
          Pickleball rulebook is copyrighted.
        </p>

        <div className="flex flex-col gap-3">
          {ruleList.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              No tournament rules yet. These are the ones players ask about: warm-up, timeouts, disputes.
            </p>
          )}

          {ruleList.map((rule, i) => (
            <div key={rule.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
              <form action={updateTournamentRule.bind(null, slug, rule.id)} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-medium text-[var(--color-navy)]">Category</span>
                    <select
                      name="category"
                      defaultValue={rule.category}
                      className="rounded border-2 border-[var(--border-subtle)] bg-white px-2 py-1.5 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input label="Reference (optional)" name="source_ref" defaultValue={rule.source_ref ?? ""} />
                </div>
                <Input label="Title" name="title" defaultValue={rule.title} required />
                <Textarea label="Summary" name="summary_text" defaultValue={rule.summary_text} rows={2} required />
                <div className="flex items-center gap-2">
                  <Button type="submit" variant="outline" size="sm">
                    Save
                  </Button>
                  <span className="flex-1" />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {i + 1} of {ruleList.length}
                  </span>
                </div>
              </form>
              <div className="mt-2 flex gap-2 border-t border-[var(--border-subtle)] pt-2">
                <form action={moveTournamentRule.bind(null, slug, rule.id, "up")}>
                  <Button type="submit" variant="outline" size="sm" disabled={i === 0} aria-label="Move up">
                    ↑
                  </Button>
                </form>
                <form action={moveTournamentRule.bind(null, slug, rule.id, "down")}>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={i === ruleList.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                </form>
                <span className="flex-1" />
                <form action={removeTournamentRule.bind(null, slug, rule.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Add a rule">
        <form action={addTournamentRule.bind(null, slug)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-medium text-[var(--color-navy)]">Category</span>
              <select
                name="category"
                defaultValue="general"
                className="w-full rounded-lg border-2 border-[var(--border-subtle)] bg-white px-4 py-3 text-base"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Reference (optional)" name="source_ref" placeholder="Rule 4.A.5" />
          </div>
          <Input label="Title" name="title" placeholder="Warm-up" required />
          <Textarea label="Summary" name="summary_text" placeholder="5 minutes per match." rows={2} required />
          <Button type="submit">Add rule</Button>
        </form>
      </Card>
    </main>
  );
}
