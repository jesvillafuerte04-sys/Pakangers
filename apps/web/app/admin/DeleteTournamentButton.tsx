"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTournament } from "./actions";
import { Button } from "@/components/ui/Button";

export function DeleteTournamentButton({
  tournamentId,
  name,
  fullWidth = false,
}: {
  tournamentId: string;
  name: string;
  fullWidth?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}" permanently? This removes every player, team, match, and score under it. This can't be undone.`)) {
      return;
    }
    startTransition(() => {
      void deleteTournament(tournamentId).then(() => router.push("/admin"));
    });
  }

  return (
    <Button variant="outline" size="sm" fullWidth={fullWidth} onClick={handleClick} disabled={isPending}>
      {isPending ? "Deleting…" : "Delete tournament"}
    </Button>
  );
}
