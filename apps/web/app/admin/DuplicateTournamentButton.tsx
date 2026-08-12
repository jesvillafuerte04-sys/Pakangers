"use client";

import { useTransition } from "react";
import { duplicateTournament } from "./actions";
import { Button } from "@/components/ui/Button";

export function DuplicateTournamentButton({
  tournamentId,
  label = "Duplicate",
  fullWidth = false,
  variant = "outline",
}: {
  tournamentId: string;
  label?: string;
  fullWidth?: boolean;
  variant?: "outline" | "ghost";
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      try {
        await duplicateTournament(tournamentId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to duplicate tournament");
      }
    });
  }

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="px-3 py-1 text-xs font-bold text-[var(--color-navy)] hover:bg-white hover:shadow-xs rounded disabled:opacity-50 transition"
      >
        {isPending ? "Duplicating…" : label}
      </button>
    );
  }


  return (
    <Button variant="outline" size="sm" fullWidth={fullWidth} onClick={handleClick} disabled={isPending}>
      {isPending ? "Duplicating…" : label}
    </Button>
  );
}


