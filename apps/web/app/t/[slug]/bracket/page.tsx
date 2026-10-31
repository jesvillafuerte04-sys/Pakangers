import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/public-data";
import { getPublicBracket, type PublicBracketStage } from "@/lib/match-pipeline";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MatchCardBody } from "@/components/MatchCard";
import { BracketTree, type BracketTreeRound } from "@/components/BracketTree";

const RESOLVED = ["completed", "forfeit", "bye"];

/**
 * The rounds the tree draws, in order.
 *
 * The Round of 16 is deliberately absent: sixteen rows do not fit a phone, and
 * every one of those matches is still listed as a card below. The third-place
 * match is left out too -- it hangs off the semifinals rather than feeding the
 * final, so drawing it in the tree would imply a path that does not exist.
 */
const TREE_STAGES = ["quarterfinals", "semifinals", "championship"] as const;

function toTreeRound(s: PublicBracketStage): BracketTreeRound {
  return {
    stageKey: s.stageKey,
    stageName: s.stageName,
    matches: s.matches.map((m) => ({
      matchNumber: m.matchNumber,
      status: m.status,
      // header is the team name once known, and the slot's source until then
      // ("Bracket A — 1st"), which is exactly what an empty node should say.
      home: { label: m.home.header, score: m.homePointsTotal, isWinner: m.winnerSide === "home" },
      away: { label: m.away.header, score: m.awayPointsTotal, isWinner: m.winnerSide === "away" },
    })),
  };
}

function toTreeRounds(stages: PublicBracketStage[]): BracketTreeRound[] {
  const order = new Map<string, number>(TREE_STAGES.map((k, i) => [k, i]));
  return stages
    .filter((s) => order.has(s.stageKey) && s.matches.length > 0)
    .sort((a, b) => order.get(a.stageKey)! - order.get(b.stageKey)!)
    .map(toTreeRound);
}

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

  const treeRounds = toTreeRounds(stages);
  // A single column is a card, not a bracket. The tree only earns its place
  // once there is a path through it to trace.
  const showTree = treeRounds.length > 1;
  // Its own small graphic under the main draw, since it does not feed the final.
  const thirdPlace = stages.find((s) => s.stageKey === "third_place" && s.matches.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {showTree && (
        <Card title="The draw">
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Quarter Finals onward. Scroll sideways for the later rounds, and tap a match to jump to its card below.
          </p>
          <BracketTree rounds={treeRounds} />
          {thirdPlace && (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <BracketTree rounds={[{ ...toTreeRound(thirdPlace), stageName: "3rd Place" }]} />
            </div>
          )}
        </Card>
      )}

      {stages.map((stage) => (
        <div key={stage.stageKey} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{stage.stageName}</h2>
          {stage.matches.map((m) => {
            // The champion's card is the one place gold gets used on this screen.
            const isChampion = stage.stageKey === "championship" && m.status !== null && RESOLVED.includes(m.status);
            return (
              <Card
                key={m.matchNumber}
                id={`match-${m.matchNumber}`}
                className={`scroll-mt-20 ${isChampion ? "border-2 border-[var(--color-gold)]" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {m.fullBadgeText ?? `M${m.matchNumber} · ${m.matchLabel ?? stage.stageName}`}
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
