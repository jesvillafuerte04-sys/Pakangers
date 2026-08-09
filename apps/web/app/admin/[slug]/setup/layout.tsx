import Link from "next/link";

const STEPS = [
  { key: "info", label: "Info" },
  { key: "players", label: "Players" },
  { key: "teams", label: "Teams" },
  { key: "groups", label: "Groups" },
  { key: "stages", label: "Stages" },
  { key: "review", label: "Review & lock" },
];

export default async function SetupLayout({
  children,
  params,
}: LayoutProps<"/admin/[slug]/setup">) {
  const { slug } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/admin/${slug}`} className="text-sm font-medium text-[var(--color-navy)]">
        ← Dashboard
      </Link>

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
