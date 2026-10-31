import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-data";
import { getServiceSupabase } from "@/lib/supabase-server";
import { addPlayers, removePlayer, updatePlayerNickname } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default async function SetupPlayersPage({ params }: PageProps<"/admin/[slug]/setup/players">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const supabase = getServiceSupabase();
  const { data: players } = await supabase
    .from("player")
    .select("id, first_name, last_name, nickname, dupr_id")
    .eq("tournament_id", tournament.id)
    .order("first_name");

  const addAction = addPlayers.bind(null, slug, tournament.id);

  return (
    <div className="flex flex-col gap-6">
      <Card title="Add players">
        <form action={addAction} className="flex flex-col gap-3">
          <Textarea
            label="Paste names, one per line"
            name="names"
            rows={6}
            placeholder={"Jes Villafuerte (Jes)\nMarco Reyes (Marc)\nLea Dizon"}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Put a nickname in brackets after the name, e.g. &quot;Mevil Bacud (Meb)&quot;. Nicknames are used in
            standings notes; without one, the first name is used. DUPR ID and photos are optional — players without a photo are assigned a stylish default icon badge.
          </p>
          <Button type="submit">Add players</Button>
        </form>
      </Card>

      <Card title={`Players (${players?.length ?? 0})`}>
        <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
          {players?.length === 0 && <p className="py-3 text-sm text-[var(--color-text-muted)]">No players yet.</p>}
          {players?.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3 gap-3">
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-navy)]">
                {`${p.first_name} ${p.last_name}`.trim()}
              </span>
              <div className="flex items-center gap-3">
                <form action={updatePlayerNickname.bind(null, slug, p.id)} className="flex items-center gap-1">
                  <input
                    name="nickname"
                    defaultValue={p.nickname ?? ""}
                    placeholder="Nickname"
                    aria-label={`Nickname for ${p.first_name}`}
                    className="w-24 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs"
                  />
                  <button type="submit" className="text-xs font-medium text-[var(--color-navy)] hover:underline">
                    Save
                  </button>
                </form>
                {p.dupr_id && (
                  <span className="text-xs text-[var(--color-text-muted)]">DUPR: {p.dupr_id}</span>
                )}
                <form action={removePlayer.bind(null, slug, p.id)}>
                  <button type="submit" className="text-sm font-medium text-[var(--color-error)] hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
