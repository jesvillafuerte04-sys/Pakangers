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
  variant = "outline",
}: {
  tournamentId: string;
  name: string;
  label?: string;
  fullWidth?: boolean;
  variant?: "outline" | "ghost";
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

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 transition px-1"
      >
        {isPending ? "Deleting…" : label}
      </button>
    );
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


