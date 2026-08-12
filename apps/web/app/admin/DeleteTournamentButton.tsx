"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTournament } from "./actions";
import { Button } from "@/components/ui/Button";

export function DeleteTournamentButton({
  tournamentId,
  name,
  label = "Delete",
  fullWidth = false,
}: {
  tournamentId: string;
  name: string;
  label?: string;
  fullWidth?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErrorMsg(null);

    if (!window.confirm(`Delete "${name}" permanently? This removes every player, team, match, and score under it. This can't be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteTournament(tournamentId);
        router.push("/admin");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete tournament";
        setErrorMsg(msg);
        alert(`Could not delete tournament: ${msg}`);
      }
    });
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button variant="outline" size="sm" fullWidth={fullWidth} onClick={handleClick} disabled={isPending}>
        {isPending ? "Deleting…" : label}
      </Button>
      {errorMsg && <p className="mt-1 text-xs text-red-600 font-medium">{errorMsg}</p>}
    </div>
  );
}

