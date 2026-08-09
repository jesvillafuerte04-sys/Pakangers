import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTournamentBySlug } from "@/lib/tournament-data";

export default async function TournamentLayout({
  children,
  params,
}: LayoutProps<"/admin/[slug]">) {
  const session = await getSession();
  if (!session) redirect("/admin");

  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  return <>{children}</>;
}
