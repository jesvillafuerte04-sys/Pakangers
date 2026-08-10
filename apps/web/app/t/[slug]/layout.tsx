import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicTournament } from "@/lib/public-data";
import { PublicNav } from "@/components/PublicNav";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Badge } from "@/components/ui/Badge";
import { BuiltByCredit } from "@/components/BuiltByCredit";

export async function generateMetadata({ params }: LayoutProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) return {};
  return {
    title: tournament.name,
    description: [tournament.venue, tournament.date_start].filter(Boolean).join(" · ") || "Live tournament results",
    openGraph: { title: tournament.name, description: tournament.description ?? undefined },
  };
}

const STATUS_LABEL: Record<string, string> = {
  locked: "Starting soon",
  in_progress: "Live",
  completed: "Final results",
};

export default async function PublicTournamentLayout({
  children,
  params,
}: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-5 pb-28">
      <header className="flex flex-col gap-1.5">
        <Badge tone={tournament.status === "completed" ? "success" : "gold"}>
          {STATUS_LABEL[tournament.status] ?? tournament.status}
        </Badge>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-[var(--color-navy)]">
          {tournament.name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {tournament.venue ?? "Venue TBA"} {tournament.date_start ? `· ${tournament.date_start}` : ""}
        </p>
      </header>

      {children}

      <BuiltByCredit />

      <PublicNav slug={slug} />

      <RealtimeRefresher tournamentId={tournament.id} />
    </main>
  );
}
