import { notFound } from "next/navigation";
import { getTournamentBySlug, getDivisionForTournament } from "@/lib/tournament-data";
import { updateTournamentInfo } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default async function SetupInfoPage({ params }: PageProps<"/admin/[slug]/setup/info">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();
  const division = await getDivisionForTournament(tournament.id);

  const save = updateTournamentInfo.bind(null, slug);
  const currentTeamSize = division?.team_size ?? 2;

  return (
    <Card title="Tournament info">
      <form action={save} className="flex flex-col gap-4">
        <Input label="Name" name="name" defaultValue={tournament.name} required />

        <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
          <label className="text-sm font-semibold text-[var(--color-navy)]">
            Competition Format & Team Size
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition bg-white ${currentTeamSize === 2 ? "border-[var(--color-navy)] shadow-xs" : "border-transparent hover:border-gray-300"}`}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="team_size"
                  value="2"
                  defaultChecked={currentTeamSize === 2}
                  className="accent-[var(--color-navy)]"
                />
                <span className="font-bold text-sm text-[var(--color-navy)]">Doubles (2v2)</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] pl-5">
                Standard doubles. 2 players paired per team.
              </p>
            </label>

            <label className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition bg-white ${currentTeamSize === 1 ? "border-[var(--color-navy)] shadow-xs" : "border-transparent hover:border-gray-300"}`}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="team_size"
                  value="1"
                  defaultChecked={currentTeamSize === 1}
                  className="accent-[var(--color-navy)]"
                />
                <span className="font-bold text-sm text-[var(--color-navy)]">Singles (1v1)</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] pl-5">
                1 player per entrant. 1-click auto-generates 1v1 teams from roster.
              </p>
            </label>

            <label className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition bg-white ${currentTeamSize === 4 ? "border-[var(--color-navy)] shadow-xs" : "border-transparent hover:border-gray-300"}`}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="team_size"
                  value="4"
                  defaultChecked={currentTeamSize === 4}
                  className="accent-[var(--color-navy)]"
                />
                <span className="font-bold text-sm text-[var(--color-navy)]">Team Wars (4v4)</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] pl-5">
                Squad format (PPL/MLP style). 4 players per squad with multi-rubber ties.
              </p>
            </label>
          </div>

          <div className="mt-2">
            <Input
              label="Division Name"
              name="division_name"
              defaultValue={division?.name ?? "Open Doubles"}
              placeholder="e.g. Open Doubles, Men's Singles 4.0, Tanjay Team Wars"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Start date" name="date_start" type="date" defaultValue={tournament.date_start ?? ""} />
          <Input label="End date" name="date_end" type="date" defaultValue={tournament.date_end ?? ""} />
        </div>
        <Input label="Venue" name="venue" defaultValue={tournament.venue ?? ""} placeholder="Tanjay City, Negros Oriental" />
        <Input label="Organizer" name="organizer_name" defaultValue={tournament.organizer_name ?? ""} />
        <Textarea label="Description" name="description" defaultValue={tournament.description ?? ""} rows={3} />
        <Button type="submit">Save</Button>
      </form>
    </Card>
  );
}
