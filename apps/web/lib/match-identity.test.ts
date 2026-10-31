/** Run: node --test --experimental-strip-types lib/match-identity.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bracketLabel, continuousMatchNumbers, courtLabel, stageLabel } from "./match-identity.ts";

test("brackets are labelled by letter, whatever they are stored as", () => {
  assert.equal(bracketLabel("A", 0), "Bracket A");
  assert.equal(bracketLabel("Bracket C", 2), "Bracket C");
  assert.equal(bracketLabel("Pool B", null), "Bracket B");
  assert.equal(bracketLabel("2", null), "Bracket B", "a legacy numbered bracket reads as its letter");
  assert.equal(bracketLabel(null, 3), "Bracket D");
  assert.equal(bracketLabel("H", 7), "Bracket H", "eight brackets reach H");
  assert.equal(bracketLabel(null, null), null);
});

test("knockout stages use the organizer's own wording", () => {
  const of = (key: string, name: string) => stageLabel({ stageKey: key, stageName: name }).full;
  assert.equal(of("round_of_16", "Round of 16"), "Round of 16");
  assert.equal(of("quarterfinals", "Quarterfinals"), "Quarter Finals");
  assert.equal(of("semifinals", "Semifinals"), "Semi-Finals");
  assert.equal(of("third_place", "Third Place"), "3rd Place");
  assert.equal(of("championship", "Championship"), "Championship");
});

test("a round-robin match reads as Elimination plus its bracket", () => {
  const label = stageLabel({ stageKey: "pools", stageName: "Pool Stage", groupName: "B", groupOrder: 1 });
  assert.equal(label.stage, "Elimination");
  assert.equal(label.bracket, "Bracket B");
  assert.equal(label.full, "Elimination · Bracket B");
});

test("a court always reads as something", () => {
  assert.equal(courtLabel("Court 4"), "Court 4");
  assert.equal(courtLabel(null), "Court TBA");
  assert.equal(courtLabel("   "), "Court TBA");
});

/** Four brackets of three matches each, plus two semifinals. */
function sampleDraw() {
  const matches = [];
  for (let g = 0; g < 4; g++) {
    for (let n = 1; n <= 3; n++) {
      matches.push({ id: `g${g}m${n}`, stageId: "pools", groupId: `grp${g}`, matchNumber: g * 10 + n });
    }
  }
  matches.push({ id: "s1", stageId: "semis", groupId: null, matchNumber: 1 });
  matches.push({ id: "s2", stageId: "semis", groupId: null, matchNumber: 2 });
  return matches;
}

const CTX = {
  stageSequenceById: new Map([["pools", 1], ["semis", 2]]),
  groupOrderById: new Map([["grp0", 0], ["grp1", 1], ["grp2", 2], ["grp3", 3]]),
};

const inOrder = (numbers: Map<string, number>) =>
  [...numbers.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

test("brackets playing at the same time take turns, one match each", () => {
  // Four courts, so brackets A-D all run at once: A1, B1, C1, D1, A2, B2, ...
  const numbers = continuousMatchNumbers(sampleDraw(), { ...CTX, bracketsPerBatch: 4 });

  assert.deepEqual(inOrder(numbers), [
    "g0m1", "g1m1", "g2m1", "g3m1",
    "g0m2", "g1m2", "g2m2", "g3m2",
    "g0m3", "g1m3", "g2m3", "g3m3",
    "s1", "s2",
  ]);
  assert.equal(numbers.get("g1m1"), 2, "the first match of Bracket B is M2, not M4");
});

test("a second batch of brackets starts only after the first finishes", () => {
  // Two courts: brackets A and B play out, then C and D take the same courts.
  const numbers = continuousMatchNumbers(sampleDraw(), { ...CTX, bracketsPerBatch: 2 });

  assert.deepEqual(inOrder(numbers), [
    "g0m1", "g1m1", "g0m2", "g1m2", "g0m3", "g1m3",
    "g2m1", "g3m1", "g2m2", "g3m2", "g2m3", "g3m3",
    "s1", "s2",
  ]);
});

test("without a court count every bracket is treated as running at once", () => {
  const numbers = continuousMatchNumbers(sampleDraw(), CTX);
  assert.deepEqual(inOrder(numbers).slice(0, 4), ["g0m1", "g1m1", "g2m1", "g3m1"]);
});

test("match numbers are unique and run 1..N with no gaps", () => {
  const numbers = continuousMatchNumbers(sampleDraw(), { ...CTX, bracketsPerBatch: 4 });
  const values = [...numbers.values()].sort((a, b) => a - b);
  assert.equal(new Set(values).size, values.length);
  assert.deepEqual(values, values.map((_, i) => i + 1));
});

test("numbering does not depend on the order the matches arrive in", () => {
  const draw = sampleDraw();
  const before = continuousMatchNumbers(draw, { ...CTX, bracketsPerBatch: 4 });
  const after = continuousMatchNumbers([...draw].reverse(), { ...CTX, bracketsPerBatch: 4 });
  assert.deepEqual([...before.entries()].sort(), [...after.entries()].sort());
  assert.equal(before.get("s2"), 14, "the last semifinal keeps the number it was printed with");
});

test("brackets of different sizes still interleave, the short one just drops out", () => {
  // Bracket A has three matches, Bracket B only one.
  const numbers = continuousMatchNumbers(
    [
      { id: "a1", stageId: "pools", groupId: "grp0", matchNumber: 1 },
      { id: "a2", stageId: "pools", groupId: "grp0", matchNumber: 2 },
      { id: "a3", stageId: "pools", groupId: "grp0", matchNumber: 3 },
      { id: "b1", stageId: "pools", groupId: "grp1", matchNumber: 1 },
    ],
    { ...CTX, bracketsPerBatch: 2 },
  );
  assert.deepEqual(inOrder(numbers), ["a1", "b1", "a2", "a3"]);
});
