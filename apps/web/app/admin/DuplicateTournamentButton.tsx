"use client";

import { useTransition } from "react";
import { duplicateTournament } from "./actions";
import { Button } from "@/components/ui/Button";

export function DuplicateTournamentButton({
  tournamentId,
  fullWidth = false,
}: {
  tournamentId: string;
  fullWidth?: boolean;
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

  return (
    <Button variant="outline" size="sm" fullWidth={fullWidth} onClick={handleClick} disabled={isPending}>
      {isPending ? "Creating copy…" : "Duplicate tournament"}
    </Button>
  );
}
