import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getPublicBracket } from "@/lib/match-pipeline";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TeamMatchup } from "@/components/TeamMatchup";

export default async function PublicBracketPage({ params }: PageProps<"/t/[slug]/bracket">) {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  const stages = await getPublicBracket(tournament.id);

  if (stages.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-muted)]">No knockout stage configured for this tournament.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {stages.map((stage) => (
        <div key={stage.stageKey} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{stage.stageName}</h2>
          {stage.matches.map((m) => {
            const isChampion = stage.stageKey === "championship" && m.status && ["completed", "forfeit"].includes(m.status);
            return (
              <Card key={m.matchNumber} className={isChampion ? "border-2 border-[var(--color-gold)]" : undefined}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">Match #{m.matchNumber}</span>
                    <TeamMatchup home={m.home} away={m.away} />
                    {m.homeScore !== null && (
                      <span className="text-lg font-bold text-[var(--color-navy)]">
                        {m.homeScore}–{m.awayScore}
                      </span>
                    )}
                  </div>
                  {m.status && (
                    <Badge tone={m.status === "in_progress" ? "gold" : m.status === "pending" ? "neutral" : "success"}>
                      {m.status === "in_progress" ? "Live" : m.status.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
