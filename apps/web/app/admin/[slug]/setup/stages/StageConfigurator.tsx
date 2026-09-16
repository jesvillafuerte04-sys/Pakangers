"use client";

import { useState, useTransition } from "react";
import { configureTournamentStages } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";

type PlayoffFormat = "round_of_16" | "quarterfinals" | "semifinals" | "finals_only" | "none";

interface Props {
  slug: string;
  isDraft: boolean;
  currentStageCount: number;
}

export function StageConfigurator({ slug, isDraft, currentStageCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [playoffFormat, setPlayoffFormat] = useState<PlayoffFormat>("semifinals");
  const [includePools, setIncludePools] = useState(true);
  const [crossoverStyle, setCrossoverStyle] = useState<"opposite" | "adjacent">("opposite");
  const [poolCount, setPoolCount] = useState(2);
  const [advancePerPool, setAdvancePerPool] = useState(2);
  const [includeThirdPlace, setIncludeThirdPlace] = useState(true);

  // Scoring
  const [pointsToWin, setPointsToWin] = useState(15);
  const [winBy, setWinBy] = useState("sudden_death");
  const [bestOf, setBestOf] = useState(1);
  const [scoringType, setScoringType] = useState("side_out");

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Auto-adjust advance per pool when playoff format or pool count changes
  const handlePlayoffChange = (format: PlayoffFormat) => {
    setPlayoffFormat(format);
    if (format === "round_of_16") {
      setPoolCount(4);
      setAdvancePerPool(4);
      setIncludeThirdPlace(true);
    } else if (format === "quarterfinals") {
      setPoolCount(2);
      setAdvancePerPool(4);
      setIncludeThirdPlace(true);
    } else if (format === "semifinals") {
      setPoolCount(2);
      setAdvancePerPool(2);
      setIncludeThirdPlace(true);
    } else if (format === "finals_only") {
      setPoolCount(2);
      setAdvancePerPool(1);
      setIncludeThirdPlace(false);
    } else if (format === "none") {
      setIncludeThirdPlace(false);
    }
  };

  const handlePoolCountChange = (count: number) => {
    setPoolCount(count);
    if (playoffFormat === "quarterfinals") {
      setAdvancePerPool(count === 8 ? 1 : count === 4 ? 2 : 4);
    } else if (playoffFormat === "semifinals") {
      setAdvancePerPool(count === 4 ? 1 : 2);
    } else if (playoffFormat === "round_of_16") {
      setAdvancePerPool(count === 16 ? 1 : count === 8 ? 2 : count === 2 ? 8 : 4);
    } else if (playoffFormat === "finals_only") {
      setAdvancePerPool(1);
    }
  };

  const totalKnockoutSlots =
    playoffFormat === "round_of_16"
      ? 16
      : playoffFormat === "quarterfinals"
      ? 8
      : playoffFormat === "semifinals"
      ? 4
      : playoffFormat === "finals_only"
      ? 2
      : 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentStageCount > 0 && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await configureTournamentStages(slug, formData);
        setConfirmOpen(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to configure stages");
      }
    });
  };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const poolLettersDisplay =
    poolCount <= 4
      ? alphabet.slice(0, poolCount).map((l) => `Pool ${l}`).join(" & ")
      : `Pools A – ${alphabet[poolCount - 1]} (${poolCount} Pools)`;

  return (
    <div className="rounded-2xl border-2 border-[var(--color-navy)] bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-black uppercase tracking-wide text-[var(--color-navy)]">
            Stage & Playoff Configurator
          </h2>
          <span className="rounded-full bg-[var(--color-gold)]/20 px-3 py-0.5 text-xs font-bold text-[var(--color-navy)]">
            Spec 3 Active
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Configure round-robin pools, playoff bracket sizes (Top 16, Quarters, Semis, Finals), 3rd place match, and scoring.
        </p>
      </div>

      {!isDraft && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900">
          ⚠️ <strong>Tournament is locked:</strong> Stages cannot be reconfigured while the tournament is active or completed.
          Unlock the tournament from the setup review tab to modify stages.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-6">
        <input type="hidden" name="playoff_format" value={playoffFormat} />
        <input type="hidden" name="crossover_style" value={crossoverStyle} />
        <input type="hidden" name="include_pools" value={includePools ? "true" : "false"} />
        <input type="hidden" name="pool_count" value={poolCount} />
        <input type="hidden" name="advance_per_pool" value={advancePerPool} />
        <input type="hidden" name="include_third_place" value={includeThirdPlace ? "true" : "false"} />
        <input type="hidden" name="points_to_win" value={pointsToWin} />
        <input type="hidden" name="win_by" value={winBy} />
        <input type="hidden" name="best_of" value={bestOf} />
        <input type="hidden" name="scoring_type" value={scoringType} />

        {/* 1. Playoff Format */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
            1. Playoff Bracket Format
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { id: "round_of_16", label: "Round of 16 (Top 16)", desc: "16 teams · 4 rounds to champion" },
              { id: "quarterfinals", label: "Quarterfinals (Top 8)", desc: "8 teams · 3 rounds to champion" },
              { id: "semifinals", label: "Semifinals (Top 4)", desc: "4 teams · 2 rounds to champion" },
              { id: "finals_only", label: "Championship Only", desc: "Top 2 teams · 1 final match" },
              { id: "none", label: "Pure Round Robin", desc: "Pools only · No knockout bracket" },
            ].map((opt) => {
              const active = playoffFormat === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handlePlayoffChange(opt.id as PlayoffFormat)}
                  disabled={!isDraft || isPending}
                  className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition ${
                    active
                      ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white shadow-sm"
                      : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--color-text-main)] hover:border-gray-300"
                  }`}
                >
                  <span className={`text-sm font-bold ${active ? "text-[var(--color-gold)]" : "text-[var(--color-navy)]"}`}>
                    {opt.label}
                  </span>
                  <span className={`mt-0.5 text-xs ${active ? "text-gray-200" : "text-[var(--color-text-muted)]"}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Pool Stage Options */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[var(--color-navy)]">Include Round-Robin Pool Stage</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Teams play preliminary matches inside pools before advancing to the bracket.
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={includePools}
                onChange={(e) => setIncludePools(e.target.checked)}
                disabled={!isDraft || isPending}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--color-navy)] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          {includePools && (
            <div className="mt-2 grid grid-cols-1 gap-4 pt-3 border-t border-[var(--border-subtle)] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
                  Number of Pools
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 8, 16].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => handlePoolCountChange(num)}
                      disabled={!isDraft || isPending}
                      className={`flex-1 min-w-[48px] rounded-lg border-2 py-2 text-center text-sm font-bold transition ${
                        poolCount === num
                          ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-gold)]"
                          : "border-[var(--border-subtle)] bg-white text-[var(--color-navy)] hover:bg-gray-50"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {playoffFormat !== "none" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
                    Advance per Pool ({poolCount * advancePerPool} Total)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 4, 8].map((adv) => (
                      <button
                        type="button"
                        key={adv}
                        onClick={() => setAdvancePerPool(adv)}
                        disabled={!isDraft || isPending}
                        className={`flex-1 rounded-lg border-2 py-2 text-center text-sm font-bold transition ${
                          advancePerPool === adv
                            ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-gold)]"
                            : "border-[var(--border-subtle)] bg-white text-[var(--color-navy)] hover:bg-gray-50"
                        }`}
                      >
                        Top {adv}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crossover Seeding Options */}
        {includePools && poolCount >= 4 && playoffFormat !== "none" && (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[var(--color-navy)]">Bracket Crossover Pairing Style</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Choose how advancing teams from different pools match up in the first playoff round.
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCrossoverStyle("opposite")}
                disabled={!isDraft || isPending}
                className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition ${
                  crossoverStyle === "opposite"
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white shadow-sm"
                    : "border-[var(--border-subtle)] bg-white text-[var(--color-text-main)] hover:border-gray-300"
                }`}
              >
                <span className={`text-sm font-bold ${crossoverStyle === "opposite" ? "text-[var(--color-gold)]" : "text-[var(--color-navy)]"}`}>
                  ⚡ Opposite Pools ({poolCount >= 8 ? "A1 vs H2" : "A1 vs D2"})
                </span>
                <span className={`mt-0.5 text-xs ${crossoverStyle === "opposite" ? "text-gray-200" : "text-[var(--color-text-muted)]"}`}>
                  Local standard: Top seeds face the furthest runner-up ({poolCount >= 8 ? "A1 vs H2, B1 vs G2, C1 vs F2, D1 vs E2" : "A1 vs D2, B1 vs C2"}).
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCrossoverStyle("adjacent")}
                disabled={!isDraft || isPending}
                className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition ${
                  crossoverStyle === "adjacent"
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white shadow-sm"
                    : "border-[var(--border-subtle)] bg-white text-[var(--color-text-main)] hover:border-gray-300"
                }`}
              >
                <span className={`text-sm font-bold ${crossoverStyle === "adjacent" ? "text-[var(--color-gold)]" : "text-[var(--color-navy)]"}`}>
                  Adjacent Pools (A1 vs B2, C1 vs D2)
                </span>
                <span className={`mt-0.5 text-xs ${crossoverStyle === "adjacent" ? "text-gray-200" : "text-[var(--color-text-muted)]"}`}>
                  Standard consecutive pairing (A1 vs B2, C1 vs D2, E1 vs F2, G1 vs H2).
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Knockout Extras & 3rd Place */}
        {playoffFormat !== "none" && playoffFormat !== "finals_only" && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[var(--color-navy)]">3rd Place Bronze Medal Match</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Semifinal losers play off for 3rd place podium bronze.
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={includeThirdPlace}
                onChange={(e) => setIncludeThirdPlace(e.target.checked)}
                disabled={!isDraft || isPending}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--color-navy)] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        )}

        {/* 4. Match Scoring Presets */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
            2. Match Scoring Rules
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Points to Win</span>
              <select
                value={pointsToWin}
                onChange={(e) => setPointsToWin(Number(e.target.value))}
                disabled={!isDraft || isPending}
                className="rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-navy)]"
              >
                <option value={11}>11 Points</option>
                <option value={15}>15 Points</option>
                <option value={21}>21 Points</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Win Condition</span>
              <select
                value={winBy}
                onChange={(e) => setWinBy(e.target.value)}
                disabled={!isDraft || isPending}
                className="rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-navy)]"
              >
                <option value="sudden_death">Sudden Death (1st to point)</option>
                <option value="win_by_two">Win by 2 (Deuce)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Game Structure</span>
              <select
                value={bestOf}
                onChange={(e) => setBestOf(Number(e.target.value))}
                disabled={!isDraft || isPending}
                className="rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-navy)]"
              >
                <option value={1}>1 Game Match</option>
                <option value={3}>Best of 3 Games</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Scoring Mode</span>
              <select
                value={scoringType}
                onChange={(e) => setScoringType(e.target.value)}
                disabled={!isDraft || isPending}
                className="rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-navy)]"
              >
                <option value="side_out">Side-out (Traditional)</option>
                <option value="rally">Rally Scoring</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. Live Flow Preview */}
        <div className="rounded-xl border border-[var(--color-gold)] bg-[var(--color-gold)]/10 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
            ⚡ Resulting Tournament Flow
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {includePools && (
              <>
                <span className="rounded-lg bg-[var(--color-navy)] px-2.5 py-1 text-[var(--color-gold)]">
                  {poolLettersDisplay} (Round-Robin)
                </span>
                {playoffFormat !== "none" && <span className="text-[var(--color-navy)] font-black">➔</span>}
              </>
            )}

            {playoffFormat === "round_of_16" && (
              <>
                <span className="rounded-lg bg-blue-700 px-2.5 py-1 text-white">Round of 16 (8 matches)</span>
                <span className="text-[var(--color-navy)] font-black">➔</span>
              </>
            )}

            {(playoffFormat === "round_of_16" || playoffFormat === "quarterfinals") && (
              <>
                <span className="rounded-lg bg-indigo-700 px-2.5 py-1 text-white">Quarterfinals (4 matches)</span>
                <span className="text-[var(--color-navy)] font-black">➔</span>
              </>
            )}

            {(playoffFormat === "round_of_16" ||
              playoffFormat === "quarterfinals" ||
              playoffFormat === "semifinals") && (
              <>
                <span className="rounded-lg bg-purple-700 px-2.5 py-1 text-white">Semifinals (2 matches)</span>
                <span className="text-[var(--color-navy)] font-black">➔</span>
              </>
            )}

            {playoffFormat !== "none" && (
              <span className="rounded-lg bg-amber-600 px-2.5 py-1 text-white">
                Championship {includeThirdPlace && "& 3rd Place Match"}
              </span>
            )}
          </div>

          <p className="mt-2.5 text-xs text-[var(--color-text-muted)]">
            Scoring: First to {pointsToWin} ({winBy.replace("_", " ")}) · {bestOf === 1 ? "1 game" : "Best of 3"} ·{" "}
            {scoringType === "side_out" ? "Side-out" : "Rally"}
          </p>
        </div>

        {/* Confirmation prompt if replacing existing stages */}
        {confirmOpen && (
          <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-4 text-xs">
            <p className="font-bold text-rose-900">
              ⚠️ Replacing existing stages: This will clear current stage setup and regenerate matches and bracket nodes.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="submit"
                size="sm"
                className="!bg-rose-600 !text-white hover:!bg-rose-700"
                disabled={isPending}
              >
                {isPending ? "Generating..." : "Yes, Reconfigure Stages"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!confirmOpen && (
          <Button type="submit" size="lg" disabled={!isDraft || isPending} fullWidth>
            {isPending ? "Configuring Stages..." : "⚡ Generate & Apply Stage Configuration"}
          </Button>
        )}
      </form>
    </div>
  );
}
