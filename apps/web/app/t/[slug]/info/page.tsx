import { notFound } from "next/navigation";
import { getPublicTournament, getPublicRules } from "@/lib/public-data";
import { Card } from "@/components/ui/Card";

function winByLabel(winBy: string): string {
  return winBy === "win_by_two" ? "win by 2" : "sudden death";
}

export default async function PublicInfoPage({ params }: PageProps<"/t/[slug]/info">) {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  const rules = await getPublicRules(tournament.id);

  return (
    <div className="flex flex-col gap-5">
      {rules.scoringByStage.length > 0 && (
        <Card title="Scoring by stage" className="border-2 border-[var(--color-gold)]">
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {rules.scoringByStage.map((s) => (
              <div key={s.stageName} className="flex items-center justify-between py-2">
                <span className="font-medium text-[var(--color-navy)]">{s.stageName}</span>
                <span className="text-right text-sm text-[var(--color-text-muted)]">
                  To {s.pointsToWin}, {winByLabel(s.winBy)}
                  {s.cap ? `, cap ${s.cap}` : ""}
                  {s.bestOf > 1 ? `, best of ${s.bestOf}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rules.ruleSet && (
        <Card title="Official rules">
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">
            This tournament uses the {rules.ruleSet.name}
            {/* Most rule-set names already carry the year ("... — 2026"); don't say it twice. */}
            {rules.ruleSet.editionYear && !rules.ruleSet.name.includes(String(rules.ruleSet.editionYear))
              ? `, ${rules.ruleSet.editionYear} edition`
              : ""}
            .
          </p>
          <a href={rules.ruleSet.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--color-navy)] underline">
            Read the official rules ↗
          </a>
        </Card>
      )}

      {rules.tournamentRules.length > 0 && (
        <Card title="Tournament rules">
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {rules.tournamentRules.map((r, i) => (
              <div key={i} className={`flex items-start gap-3.5 ${i > 0 ? "pt-4" : ""} ${i < rules.tournamentRules.length - 1 ? "pb-4" : "pb-1"}`}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white mt-0.5">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-[var(--color-navy)]">{r.title}</h3>
                    {r.sourceRef && (
                      <span className="text-xs font-medium bg-[var(--surface-sunken)] px-2 py-0.5 rounded text-[var(--color-text-muted)]">
                        {r.sourceRef}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
                    {r.summaryText}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}


      {rules.scoringByStage.length === 0 && !rules.ruleSet && rules.tournamentRules.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">No rules published for this tournament yet.</p>
        </Card>
      )}
    </div>
  );
}
