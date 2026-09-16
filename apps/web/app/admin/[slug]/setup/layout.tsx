import Link from "next/link";

const STEPS = [
  { key: "info", label: "Info" },
  { key: "players", label: "Players" },
  { key: "teams", label: "Teams" },
  { key: "stages", label: "Stages" },
  { key: "groups", label: "Brackets" },
  { key: "review", label: "Review & lock" },
];

import { getTournamentBySlug } from "@/lib/tournament-data";
import { LockEditToggle } from "@/app/admin/LockEditToggle";

export default async function SetupLayout({
  children,
  params,
}: LayoutProps<"/admin/[slug]/setup">) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  const isLocked = tournament?.status !== "draft";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href={`/admin/${slug}`} className="text-sm font-medium text-[var(--color-navy)]">
          ← Dashboard
        </Link>
        {tournament && <LockEditToggle slug={slug} status={tournament.status} size="sm" />}
      </div>

      {isLocked && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span>
              <strong>Setup is locked.</strong> You cannot edit while locked. Toggle to <strong>Edit</strong> above to make changes.
            </span>
          </div>
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        {STEPS.map((step) => (
          <Link
            key={step.key}
            href={`/admin/${slug}/setup/${step.key}`}
            className="rounded-full border-2 border-[var(--color-navy)] px-4 py-1.5 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-[var(--color-gold)]"
          >
            {step.label}
          </Link>
        ))}
      </nav>

      {children}
    </main>
  );
}
