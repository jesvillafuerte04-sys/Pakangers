"use client";

import { useState } from "react";
import { TeamLine } from "@/components/TeamMatchup";
import type { TeamDisplay } from "@/lib/team-display";
import type { StandingStat, StandingHistoryEntry } from "@/lib/match-pipeline";

export function StandingsRow({
  rank,
  team,
  unresolvedTie,
  isQualifying,
  wins,
  losses,
  pointDifferential,
  pointsFor,
  stats,
  history,
}: {
  rank: number;
  team: TeamDisplay;
  unresolvedTie: boolean;
  isQualifying: boolean;
  wins: number;
  losses: number;
  pointDifferential: number;
  pointsFor: number;
  stats: StandingStat[];
  history: StandingHistoryEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
          isQualifying ? "bg-[var(--color-navy)] shadow-[var(--shadow-sm)]" : "bg-[var(--surface-sunken)]"
        }`}
      >
        <span className="flex w-6 flex-none flex-col items-center gap-1 pt-0.5">
          <span
            className={`text-lg font-bold ${isQualifying ? "text-[var(--color-gold)]" : "text-[var(--color-text-muted)]"}`}
          >
            {rank}
          </span>
          {isQualifying && <span className="h-0.5 w-4 rounded-full bg-[var(--color-gold)]" />}
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <TeamLine display={team} variant={isQualifying ? "light" : "dark"} />
          {isQualifying && (
            <span className="w-fit rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-navy)]">
              Advancing
            </span>
          )}
          {unresolvedTie && (
            <span className={`text-xs ${isQualifying ? "text-[var(--color-cream-dark)] opacity-70" : "text-[var(--color-text-muted)]"}`}>
              (tied)
            </span>
          )}
        </span>
        <span className="flex flex-none flex-col items-end gap-0.5 whitespace-nowrap">
          <span className="flex items-baseline gap-1 text-base font-bold">
            <span className={isQualifying ? "text-emerald-300" : "text-[var(--color-success)]"}>{wins}</span>
            <span className={isQualifying ? "text-[var(--color-cream-dark)] opacity-60" : "text-[var(--color-text-muted)]"}>–</span>
            <span className={isQualifying ? "text-rose-300" : "text-[var(--color-error)]"}>{losses}</span>
            <span className={isQualifying ? "text-[var(--color-cream-dark)] opacity-60" : "text-[var(--color-text-muted)]"}>–</span>
            <span className={isQualifying ? "text-[var(--color-gold)]" : "text-[var(--color-navy)]"}>
              {pointDifferential >= 0 ? "+" : ""}
              {pointDifferential}
            </span>
          </span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isQualifying ? "text-[var(--color-cream-dark)] opacity-70" : "text-[var(--color-text-muted)]"
            }`}
          >
            {pointsFor} pts
          </span>
        </span>
      </button>

      {open && (
        <div className="mx-3 mb-1 mt-1 flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-white p-3">
          <div className="flex gap-4">
            {stats.map((s) => (
              <div key={s.k} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{s.k}</span>
                <span className="text-sm font-bold text-[var(--color-navy)]">{s.v}</span>
              </div>
            ))}
          </div>
          {history.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">vs {h.opponent.header}</span>
                  <span className={`font-bold ${h.isWin ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>{h.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">No matches played yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
