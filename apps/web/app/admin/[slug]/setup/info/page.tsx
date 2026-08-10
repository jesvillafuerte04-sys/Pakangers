import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { updateTournamentInfo } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default async function SetupInfoPage({ params }: PageProps<"/admin/[slug]/setup/info">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const save = updateTournamentInfo.bind(null, slug);

  return (
    <Card title="Tournament info">
      <form action={save} className="flex flex-col gap-4">
        <Input label="Name" name="name" defaultValue={tournament.name} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start date" name="date_start" type="date" defaultValue={tournament.date_start ?? ""} />
          <Input label="End date" name="date_end" type="date" defaultValue={tournament.date_end ?? ""} />
        </div>
        <Input label="Venue" name="venue" defaultValue={tournament.venue ?? ""} placeholder="Tanjay City, Negros Oriental" />
        <Input label="Organizer" name="organizer_name" defaultValue={tournament.organizer_name ?? ""} />
        <Input
          label="Logo URL (optional)"
          name="logo_url"
          type="url"
          defaultValue={tournament.logo_url ?? ""}
          placeholder="https://example.com/logo.png"
        />
        <Textarea label="Description" name="description" defaultValue={tournament.description ?? ""} rows={3} />
        <Button type="submit">Save</Button>
      </form>
    </Card>
  );
}
