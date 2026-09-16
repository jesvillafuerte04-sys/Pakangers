"use client";

import { useTransition } from "react";
import { setBracketCount } from "@/app/admin/actions";

interface Props {
  slug: string;
  stageId: string;
  currentCount: number;
  isDraft: boolean;
}

export function BracketCountSelector({ slug, stageId, currentCount, isDraft }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (newCount: number) => {
    if (newCount === currentCount) return;
    startTransition(async () => {
      try {
        await setBracketCount(slug, stageId, newCount);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update bracket count");
      }
    });
  };

  const allowedCounts = [1, 2, 4, 8];

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
        Brackets:
      </label>
      <select
        value={currentCount}
        onChange={(e) => handleChange(Number(e.target.value))}
        disabled={!isDraft || isPending}
        className="rounded-lg border-2 border-[var(--color-navy)] bg-white px-2.5 py-1 text-xs font-bold text-[var(--color-navy)] shadow-xs transition hover:border-[var(--color-navy-hover)] focus:border-[var(--color-navy)] focus:outline-none disabled:opacity-50"
      >
        {allowedCounts.map((num) => (
          <option key={num} value={num}>
            {num} {num === 1 ? "Bracket" : "Brackets"}
          </option>
        ))}
        {!allowedCounts.includes(currentCount) && (
          <option value={currentCount} disabled>
            {currentCount} Brackets (Custom)
          </option>
        )}
      </select>
      {isPending && <span className="text-xs font-medium text-[var(--color-text-muted)] animate-pulse">Updating...</span>}
    </div>
  );
}
