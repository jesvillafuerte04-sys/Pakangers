type Tone = "gold" | "navy" | "success" | "error" | "neutral";

const tones: Record<Tone, string> = {
  gold: "bg-[var(--color-gold)] text-[var(--color-navy)]",
  navy: "bg-[var(--color-navy)] text-[var(--color-gold)]",
  success: "bg-[var(--color-success)] text-white",
  error: "bg-[var(--color-error)] text-white",
  neutral: "bg-[var(--surface-sunken)] text-[var(--color-text-muted)]",
};

export function Badge({ tone = "gold", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
