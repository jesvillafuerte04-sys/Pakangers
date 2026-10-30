"use client";

import { useState } from "react";
import { TeamLine } from "@/components/TeamMatchup";
import type { TeamDisplay } from "@/lib/team-display";
import type { StandingStat, StandingHistoryEntry } from "@/lib/match-pipeline";

export function StandingsRow({
  rank,
  team,
  needsCoinToss,
  isQualifying,
  advancementReason,
  outcomeNote,
  wins,
  losses,
  pointDifferential,
  pointsFor,
  stats,
  history,
}: {
  rank: number;
  team: TeamDisplay;
  /**
   * A tie the tie-break order could not settle, in a bracket that has finished.
   * The caller gates this on the bracket being complete: before then every tie
   * is temporary, and an unplayed bracket is nothing but ties.
   */
  needsCoinToss: boolean;
  isQualifying: boolean;
  advancementReason?: string | null;
  outcomeNote?: string | null;
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
        <span className="flex flex-1 flex-col gap-1 min-w-0">
          <TeamLine display={team} variant={isQualifying ? "light" : "dark"} />
          {isQualifying && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-fit rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-navy)]">
                Advancing
              </span>
              {advancementReason && (
                <span className="text-[10px] font-medium text-[var(--color-gold)] truncate max-w-[220px] sm:max-w-none">
                  {advancementReason}
                </span>
              )}
            </div>
          )}
          {needsCoinToss && (
            <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Coin toss needed
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

          {outcomeNote && (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              {outcomeNote}
            </div>
          )}
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
