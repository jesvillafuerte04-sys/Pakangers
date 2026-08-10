"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateGameScore, matchWinner, type Game } from "@pakangers/engine";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { saveMatchScore, type ScorePayload, type SaveScoreResult } from "../actions";
import type { MatchDetail } from "@/lib/match-data";
import type { AffectedDownstreamMatch } from "@/lib/match-pipeline";

type GameInput = { home: string; away: string };

function toGames(inputs: GameInput[]): Game[] {
  return inputs
    .filter((g) => g.home !== "" && g.away !== "")
    .map((g, i) => ({ gameNumber: i + 1, homeScore: Number(g.home), awayScore: Number(g.away) }));
}

export function ScoreEntryForm({ slug, match }: { slug: string; match: MatchDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const cfg = match.scoringConfig;

  const initialGames: GameInput[] =
    match.existingGames.length > 0
      ? match.existingGames.map((g) => ({ home: String(g.homeScore), away: String(g.awayScore) }))
      : [{ home: "", away: "" }];

  const [games, setGames] = useState<GameInput[]>(initialGames);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<AffectedDownstreamMatch[] | null>(null);
  const [showForfeit, setShowForfeit] = useState(false);
  const [forfeitWinner, setForfeitWinner] = useState<"home" | "away">("home");
  const [resultType, setResultType] = useState<"forfeit" | "default" | "retired">("forfeit");
  const [reason, setReason] = useState("");

  const visibleCount = useMemo(() => {
    let count = 1;
    for (let i = 1; i < cfg.bestOf; i++) {
      const priorFilled = games.slice(0, i).every((g) => g.home !== "" && g.away !== "");
      if (!priorFilled) break;
      const soFar = toGames(games.slice(0, i));
      if (soFar.length === i && !matchWinner(cfg, soFar)) count = i + 1;
    }
    return Math.min(count, cfg.bestOf);
  }, [games, cfg]);

  function updateGame(index: number, side: "home" | "away", value: string) {
    setGames((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push({ home: "", away: "" });
      next[index] = { ...next[index], [side]: value };
      return next;
    });
    setError(null);
  }

  async function submit(payload: ScorePayload, confirmInvalidation: boolean) {
    setError(null);
    const result: SaveScoreResult = await saveMatchScore(slug, match.id, payload, confirmInvalidation);
    if (result.ok) {
      router.push(`/admin/${slug}/matches`);
      return;
    }
    if ("needsConfirmation" in result) {
      setConfirmation(result.affected);
      return;
    }
    setError(result.error);
  }

  function handleSubmitScore() {
    const parsed = toGames(games.slice(0, visibleCount));
    if (parsed.length === 0) {
      setError("Enter at least one game score.");
      return;
    }
    for (const g of parsed) {
      const issues = validateGameScore(cfg, g);
      if (issues.length > 0) {
        setError(issues[0]!.message);
        return;
      }
    }
    if (!matchWinner(cfg, parsed)) {
      setError("Not enough games entered yet to determine a winner.");
      return;
    }
    startTransition(() => {
      void submit({ kind: "score", games: parsed.map((g) => ({ homeScore: g.homeScore, awayScore: g.awayScore })) }, false);
    });
  }

  function handleConfirm() {
    const parsed = toGames(games.slice(0, visibleCount));
    startTransition(() => {
      void submit({ kind: "score", games: parsed.map((g) => ({ homeScore: g.homeScore, awayScore: g.awayScore })) }, true);
    });
  }

  function handleForfeit() {
    const winningTeamId = forfeitWinner === "home" ? match.homeTeamId : match.awayTeamId;
    startTransition(() => {
      void submit({ kind: "forfeit", winningTeamId, resultType, reason: reason || undefined }, false);
    });
  }

  if (confirmation) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border-2 border-[var(--color-error)] bg-red-50 p-4">
        <p className="font-bold text-[var(--color-error)]">This changes who qualified downstream</p>
        <p className="text-sm">Saving this correction changes the following already-created match(es):</p>
        <ul className="flex flex-col gap-2 text-sm">
          {confirmation.map((a) => (
            <li key={a.matchId} className="rounded bg-white p-2">
              Match #{a.matchNumber} ({a.stageName}): {a.before.home ?? "TBD"} vs {a.before.away ?? "TBD"} →{" "}
              {a.after.home ?? "TBD"} vs {a.after.away ?? "TBD"}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfirmation(null)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            Yes, save anyway
          </Button>
        </div>
      </div>
    );
  }

  if (showForfeit) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-[var(--color-navy)]">Which team won?</p>
        <div className="flex gap-2">
          <Button
            variant={forfeitWinner === "home" ? "primary" : "outline"}
            onClick={() => setForfeitWinner("home")}
            fullWidth
          >
            {match.homeTeamName}
          </Button>
          <Button
            variant={forfeitWinner === "away" ? "primary" : "outline"}
            onClick={() => setForfeitWinner("away")}
            fullWidth
          >
            {match.awayTeamName}
          </Button>
        </div>

        <div className="flex gap-2">
          {(["forfeit", "default", "retired"] as const).map((t) => (
            <Button key={t} variant={resultType === t ? "primary" : "outline"} size="sm" onClick={() => setResultType(t)}>
              {t}
            </Button>
          ))}
        </div>

        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowForfeit(false)} disabled={isPending}>
            Back to score entry
          </Button>
          <Button onClick={handleForfeit} disabled={isPending} fullWidth>
            Record result
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: visibleCount }, (_, i) => games[i] ?? { home: "", away: "" }).map((g, i) => (
        <div key={i} className="flex flex-col gap-2">
          {cfg.bestOf > 1 && <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Game {i + 1}</p>}
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center justify-between gap-2">
              <span className="font-medium text-[var(--color-navy)]">{match.homeTeamName}</span>
              <input
                type="number"
                inputMode="numeric"
                value={g.home}
                onChange={(e) => updateGame(i, "home", e.target.value)}
                className="w-20 rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-3 text-center text-xl font-bold outline-none focus:border-[var(--color-gold)]"
              />
            </div>
            <div className="flex flex-1 items-center justify-between gap-2">
              <span className="font-medium text-[var(--color-navy)]">{match.awayTeamName}</span>
              <input
                type="number"
                inputMode="numeric"
                value={g.away}
                onChange={(e) => updateGame(i, "away", e.target.value)}
                className="w-20 rounded-lg border-2 border-[var(--border-subtle)] bg-white px-3 py-3 text-center text-xl font-bold outline-none focus:border-[var(--color-gold)]"
              />
            </div>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

      <Button onClick={handleSubmitScore} disabled={isPending} fullWidth size="lg">
        Save result
      </Button>

      <button
        type="button"
        onClick={() => setShowForfeit(true)}
        className="text-sm font-medium text-[var(--color-text-muted)] underline"
      >
        Forfeit / default / retired instead
      </button>
    </div>
  );
}
