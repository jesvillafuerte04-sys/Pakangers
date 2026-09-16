"use client";

import { useState, useTransition } from "react";
import { saveTeamWarsLineup } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";

interface Props {
  slug: string;
  isDraft: boolean;
  initialRubbers?: string[];
}

const DEFAULT_RUBBERS = ["Doubles Men", "Doubles Women", "Mixed 1"];

export function TeamWarsLineupConfigurator({ slug, isDraft, initialRubbers }: Props) {
  const [rubbers, setRubbers] = useState<string[]>(
    initialRubbers && initialRubbers.length > 0 ? initialRubbers : DEFAULT_RUBBERS
  );
  const [customName, setCustomName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const addRubber = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRubbers((prev) => [...prev, trimmed]);
    setCustomName("");
    setSavedSuccess(false);
  };

  const removeRubber = (index: number) => {
    if (rubbers.length <= 1) return;
    setRubbers((prev) => prev.filter((_, i) => i !== index));
    setSavedSuccess(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveTeamWarsLineup(slug, rubbers);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to save Team Wars lineup");
      }
    });
  };

  const PRESETS = ["Mixed 2", "Singles 1", "Singles 2", "Dreambreaker"];

  return (
    <div className="mt-4 rounded-xl border-2 border-[var(--color-navy)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase text-[var(--color-navy)] flex items-center gap-1.5">
            <span>⚔️</span> Team Wars Match Tie Lineup
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            A clan match tie consists of these sub-matches. Starts with Doubles Men, Doubles Women, and Mixed 1, with custom additions:
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-gold)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--color-navy)]">
          {rubbers.length} Rubbers
        </span>
      </div>

      {/* Current Rubbers List */}
      <div className="mt-3 flex flex-col gap-2">
        {rubbers.map((rubber, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold text-[var(--color-gold)]">
                {index + 1}
              </span>
              <span className="font-semibold text-[var(--color-text-main)]">{rubber}</span>
            </div>
            {isDraft && rubbers.length > 1 && (
              <button
                type="button"
                onClick={() => removeRubber(index)}
                disabled={isPending}
                className="text-xs font-medium text-[var(--color-error)] hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Quick Add Presets */}
      {isDraft && (
        <div className="mt-4 flex flex-col gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
            Quick Add Sub-Match:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => addRubber(preset)}
                disabled={isPending}
                className="rounded-full border border-[var(--color-navy)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-[var(--color-gold)] transition"
              >
                + {preset}
              </button>
            ))}
          </div>

          {/* Custom Name Input */}
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Custom sub-match name (e.g. Senior Doubles)"
              className="flex-1 rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs outline-none focus:border-[var(--color-gold)]"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRubber(customName);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addRubber(customName)}
              disabled={!customName.trim() || isPending}
            >
              + Add
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Team Wars Lineup"}
            </Button>
            {savedSuccess && (
              <span className="text-xs font-bold text-[var(--color-success)]">
                ✓ Team Wars Lineup Saved!
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
