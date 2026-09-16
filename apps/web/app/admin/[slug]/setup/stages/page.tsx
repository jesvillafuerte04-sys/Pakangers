import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { saveAsTemplate } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

import { StageConfigurator } from "./StageConfigurator";

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
    <div className="flex flex-col gap-6">
      <StageConfigurator
        slug={slug}
        isDraft={tournament.status === "draft"}
        currentStageCount={stages?.length ?? 0}
      />

      <div className="flex flex-col gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[var(--color-navy)]">
          Current Configured Stages ({stages?.length ?? 0})
        </h3>
        {(!stages || stages.length === 0) && (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">No stages configured yet. Use the configurator above to set them up.</p>
          </Card>
        )}
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

      <Card title="Save as template">
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Stores this tournament&apos;s setup — stages, scoring, groups, bracket wiring and qualification — as a
          reusable template, so next year can start from what actually worked. Players, teams and scores are never
          copied.
        </p>
        <form action={saveAsTemplate.bind(null, slug)} className="flex flex-col gap-3">
          <Input
            label="Template name"
            name="name"
            required
            placeholder={`${tournament.name} — ${new Date().getFullYear()} edition`}
          />
          <Textarea label="Description (optional)" name="description" rows={2} />
          <Button type="submit" variant="outline">
            Save as template
          </Button>
        </form>
      </Card>
    </div>
  );
}
