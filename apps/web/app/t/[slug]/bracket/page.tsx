import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getPublicBracket } from "@/lib/match-pipeline";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MatchCardBody } from "@/components/MatchCard";

const RESOLVED = ["completed", "forfeit", "bye"];

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
            // The champion's card is the one place gold gets used on this screen.
            const isChampion = stage.stageKey === "championship" && m.status !== null && RESOLVED.includes(m.status);
            return (
              <Card key={m.matchNumber} className={isChampion ? "border-2 border-[var(--color-gold)]" : undefined}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    M{m.matchNumber} · {stage.stageName}
                  </span>
                  {m.status ? (
                    <Badge tone={m.status === "in_progress" ? "gold" : m.status === "pending" ? "neutral" : "success"}>
                      {m.status === "in_progress" ? "Live" : m.status.replace("_", " ")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">awaiting teams</Badge>
                  )}
                </div>
                <MatchCardBody match={m} />
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
