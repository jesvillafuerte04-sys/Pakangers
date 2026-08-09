import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";

type ScoringConfig = { pointsToWin?: number; winBy?: string; bestOf?: number; scoringType?: string };

export default async function SetupStagesPage({ params }: PageProps<"/admin/[slug]/setup/stages">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const supabase = getServiceSupabase();
  const { data: stages } = await supabase
    .from("stage")
    .select("id, key, name, format_key, sequence, scoring_config")
    .eq("tournament_id", tournament.id)
    .order("sequence");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Pre-filled from the tournament&apos;s template. Editing stage configuration in the app comes in a later phase —
        for now, changes to scoring or bracket wiring go through the database directly.
      </p>
      {stages?.map((stage) => {
        const scoring = (stage.scoring_config ?? {}) as ScoringConfig;
        return (
          <Card key={stage.id} title={stage.name}>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-[var(--color-text-muted)]">Format</dt>
              <dd className="text-right font-medium">{stage.format_key.replace("_", " ")}</dd>
              <dt className="text-[var(--color-text-muted)]">Points to win</dt>
              <dd className="text-right font-medium">{scoring.pointsToWin ?? "—"}</dd>
              <dt className="text-[var(--color-text-muted)]">Win condition</dt>
              <dd className="text-right font-medium">{scoring.winBy?.replace("_", " ") ?? "—"}</dd>
              <dt className="text-[var(--color-text-muted)]">Best of</dt>
              <dd className="text-right font-medium">{scoring.bestOf ?? "—"}</dd>
            </dl>
          </Card>
        );
      })}
    </div>
  );
}
