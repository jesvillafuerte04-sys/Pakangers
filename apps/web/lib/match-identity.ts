/**
 * One source of truth for how a match is identified on screen: its number, its
 * stage label and its court.
 *
 * Both the Admin Console and the Public Console read from here, because they
 * used to number matches independently -- the Schedule page ordered brackets by
 * raw group id (a random uuid) while the Matches pages ordered them by display
 * order, so the same match could be M7 on one screen and M11 on another.
 */

/** Stage labels, in the organizer's own vocabulary. */
export type StageLabelInput = {
  stageKey?: string | null;
  stageName: string;
  /** Bracket name as stored ("A", "1", "Bracket C" ...). */
  groupName?: string | null;
  /** Zero-based position of the bracket, which is what "Bracket 1" counts from. */
  groupOrder?: number | null;
};

export type StageLabel = {
  /** The stage on its own: "Elimination", "Semi-Finals", ... */
  stage: string;
  /** The bracket within an elimination stage: "Bracket 1", else null. */
  bracket: string | null;
  /** What the badge shows: "Elimination · Bracket 1" or "Quarter Finals". */
  full: string;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Brackets read as letters: Bracket A, Bracket B, and so on.
 *
 * Groups are stored as single letters, but older data and hand-typed names
 * also appear as "1", "Pool B" or "Bracket 3", so a number is converted back
 * to its letter and the stored position is the fallback.
 */
export function bracketLabel(groupName: string | null | undefined, groupOrder: number | null | undefined): string | null {
  if (!groupName && (groupOrder === null || groupOrder === undefined)) return null;

  const stripped = (groupName ?? "").replace(/^(Bracket|Pool|Group)\s*/i, "").trim();

  if (/^[A-Z]$/i.test(stripped)) return `Bracket ${stripped.toUpperCase()}`;
  if (/^\d+$/.test(stripped)) {
    const letter = LETTERS[Number(stripped) - 1];
    if (letter) return `Bracket ${letter}`;
  }
  if (typeof groupOrder === "number" && LETTERS[groupOrder]) return `Bracket ${LETTERS[groupOrder]}`;
  return stripped ? `Bracket ${stripped}` : null;
}

export function stageLabel(input: StageLabelInput): StageLabel {
  const k = (input.stageKey ?? "").toLowerCase();
  const n = (input.stageName ?? "").toLowerCase();
  const is = (...needles: string[]) => needles.some((x) => k.includes(x) || n.includes(x));

  // Knockout stages exist in the database only when the format uses them, so
  // matching on what is there is also what makes them "shown only when applicable".
  if (is("16")) return { stage: "Round of 16", bracket: null, full: "Round of 16" };
  if (is("quarter")) return { stage: "Quarter Finals", bracket: null, full: "Quarter Finals" };
  if (is("semi")) return { stage: "Semi-Finals", bracket: null, full: "Semi-Finals" };
  if (is("third")) return { stage: "Fight for 3rd Place", bracket: null, full: "Fight for 3rd Place" };
  if (is("champ") || is("final")) return { stage: "Championship", bracket: null, full: "Championship" };

  const bracket = bracketLabel(input.groupName, input.groupOrder);
  return { stage: "Elimination", bracket, full: bracket ? `Elimination · ${bracket}` : "Elimination" };
}

/** A court always shows, so a blank one reads as a gap rather than as nothing. */
export function courtLabel(courtName: string | null | undefined): string {
  return courtName?.trim() ? courtName : "Court TBA";
}

export type NumberableMatch = {
  id: string;
  stageId: string;
  groupId: string | null;
  matchNumber: number;
};

export type NumberingContext = {
  stageSequenceById: Map<string, number>;
  groupOrderById: Map<string, number>;
};

/**
 * Continuous match numbers, 1..N, across every stage of a tournament.
 *
 * Every match is numbered, including knockout matches whose teams are still
 * TBD, so the number printed on a scoresheet before the event is the number
 * the match keeps once the bracket resolves.
 */
export function continuousMatchNumbers(
  matches: NumberableMatch[],
  ctx: NumberingContext,
): Map<string, number> {
  const seq = (m: NumberableMatch) => ctx.stageSequenceById.get(m.stageId) ?? 0;
  const grp = (m: NumberableMatch) => (m.groupId ? ctx.groupOrderById.get(m.groupId) ?? 0 : -1);

  const ordered = [...matches].sort(
    (a, b) =>
      seq(a) - seq(b) ||
      grp(a) - grp(b) ||
      a.matchNumber - b.matchNumber ||
      a.id.localeCompare(b.id), // last resort, so the order is never arbitrary
  );

  return new Map(ordered.map((m, i) => [m.id, i + 1]));
}
