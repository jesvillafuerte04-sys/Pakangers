"use client";

import { useEffect, useRef } from "react";

/**
 * The knockout draw as a bracket tree, from the Quarter Finals on.
 *
 * Why it stops at the quarters: a Round of 16 is sixteen rows deep, which on a
 * phone is a column of unreadable slivers. The cards below the tree still
 * carry every round, so nothing is hidden -- the tree only covers the part of
 * the draw that fits and that people actually trace with a finger.
 *
 * Alignment comes from the columns being equal height with each match taking
 * an equal share of it: with a field that halves each round, the midpoint
 * between two sibling matches lands exactly on the centre of the match they
 * feed, so no measuring is needed.
 */

export type BracketTreeSide = {
  /** Team name, or the slot's source while it is undecided ("Bracket A — 1st"). */
  label: string;
  score: number | null;
  isWinner: boolean;
};

export type BracketTreeMatch = {
  matchNumber: number;
  status: string | null;
  home: BracketTreeSide;
  away: BracketTreeSide;
};

export type BracketTreeRound = {
  stageKey: string;
  stageName: string;
  matches: BracketTreeMatch[];
};

const NODE_W = 168;
const CONNECTOR_W = 24;
const SLOT_MIN_H = 76;

function Side({ side, decided }: { side: BracketTreeSide; decided: boolean }) {
  const dim = decided && !side.isWinner;
  return (
    <div className={`flex items-baseline justify-between gap-2 ${dim ? "opacity-50" : ""}`}>
      <span
        className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
          side.isWinner ? "font-bold text-[var(--color-navy)]" : "font-medium text-[var(--color-text-main)]"
        }`}
        title={side.label}
      >
        {side.label}
      </span>
      {side.score !== null && (
        <span className="flex-none text-[11px] font-bold tabular-nums text-[var(--color-navy)]">{side.score}</span>
      )}
    </div>
  );
}

function Node({ match, onJump }: { match: BracketTreeMatch; onJump: () => void }) {
  const decided = match.home.isWinner || match.away.isWinner;
  const live = match.status === "in_progress";
  const awaiting = match.status === null || match.status === "pending";

  return (
    <button
      type="button"
      onClick={onJump}
      style={{ width: NODE_W }}
      aria-label={`Match ${match.matchNumber}: ${match.home.label} versus ${match.away.label}`}
      className={`flex flex-col gap-1 rounded-lg border-2 bg-white px-2 py-1.5 text-left transition hover:shadow-[var(--shadow-sm)] ${
        live
          ? "border-[var(--color-gold)]"
          : decided
            ? "border-[var(--color-navy)]"
            : "border-[var(--border-subtle)]"
      } ${awaiting ? "opacity-70" : ""}`}
    >
      <span className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        M{match.matchNumber}
        {live && <span className="text-[var(--color-gold)]">● Live</span>}
      </span>
      <Side side={match.home} decided={decided} />
      <Side side={match.away} decided={decided} />
    </button>
  );
}

/** The elbow joining a pair of matches to the one they feed. */
function Connector({ isTopOfPair }: { isTopOfPair: boolean }) {
  const line = "absolute bg-[var(--border-subtle)]";
  return (
    <>
      {/* Out of the match, to the middle of the gap. */}
      <span className={`${line} h-0.5`} style={{ left: NODE_W, top: "50%", width: CONNECTOR_W / 2 }} />
      {/* Down (or up) to meet the sibling, at the height of the next match. */}
      <span
        className={`${line} w-0.5`}
        style={{ left: NODE_W + CONNECTOR_W / 2 - 1, top: isTopOfPair ? "50%" : 0, height: "50%" }}
      />
      {/* On into the next column -- drawn once, from the top of the pair. */}
      {isTopOfPair && (
        <span className={`${line} h-0.5`} style={{ left: NODE_W + CONNECTOR_W / 2, top: "100%", width: CONNECTOR_W / 2 }} />
      )}
    </>
  );
}

export function BracketTree({ rounds }: { rounds: BracketTreeRound[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // The live round is what matters on the day, so the tree opens there rather
  // than at the quarters -- on a phone the later rounds are off-screen right.
  const currentIndex = (() => {
    const live = rounds.findIndex((r) => r.matches.some((m) => m.status === "in_progress"));
    if (live !== -1) return live;
    const unfinished = rounds.findIndex((r) => r.matches.some((m) => !m.home.isWinner && !m.away.isWinner));
    return unfinished === -1 ? rounds.length - 1 : unfinished;
  })();

  useEffect(() => {
    const scroller = scrollerRef.current;
    const current = currentRef.current;
    if (!scroller || !current) return;
    // Centre the round without scrolling the page itself, which scrollIntoView
    // would do on a narrow screen.
    const offset = current.offsetLeft - (scroller.clientWidth - current.clientWidth) / 2;
    scroller.scrollLeft = Math.max(0, offset);
  }, [currentIndex]);

  if (rounds.length === 0) return null;

  const jumpTo = (matchNumber: number) => {
    document.getElementById(`match-${matchNumber}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div
      ref={scrollerRef}
      className="-mx-1 overflow-x-auto px-1 pb-2"
      role="group"
      aria-label="Knockout bracket"
    >
      <div className="flex min-w-max">
        {rounds.map((round, r) => {
          const isLast = r === rounds.length - 1;
          return (
            <div
              key={round.stageKey}
              ref={r === currentIndex ? currentRef : undefined}
              className="flex flex-col"
              style={{ width: isLast ? NODE_W : NODE_W + CONNECTOR_W }}
            >
              <h3
                className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${
                  r === currentIndex ? "text-[var(--color-navy)]" : "text-[var(--color-text-muted)]"
                }`}
                style={{ width: NODE_W }}
              >
                {round.stageName}
              </h3>
              <div className="flex flex-1 flex-col">
                {round.matches.map((m, i) => (
                  <div
                    key={m.matchNumber}
                    className="relative flex flex-1 items-center"
                    style={{ minHeight: SLOT_MIN_H }}
                  >
                    <Node match={m} onJump={() => jumpTo(m.matchNumber)} />
                    {!isLast && <Connector isTopOfPair={i % 2 === 0} />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
