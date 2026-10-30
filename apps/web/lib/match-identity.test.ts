/** Run: node --test --experimental-strip-types lib/match-identity.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bracketLabel, continuousMatchNumbers, courtLabel, stageLabel } from "./match-identity.ts";

test("brackets are labelled by number, whatever they are stored as", () => {
  assert.equal(bracketLabel("A", 0), "Bracket 1");
  assert.equal(bracketLabel("Bracket C", 2), "Bracket 3");
  assert.equal(bracketLabel("Pool B", null), "Bracket 2");
  assert.equal(bracketLabel("2", null), "Bracket 2");
  assert.equal(bracketLabel(null, 3), "Bracket 4");
  assert.equal(bracketLabel(null, null), null);
});

test("knockout stages use the organizer's own wording", () => {
  const of = (key: string, name: string) => stageLabel({ stageKey: key, stageName: name }).full;
  assert.equal(of("round_of_16", "Round of 16"), "Round of 16");
  assert.equal(of("quarterfinals", "Quarterfinals"), "Quarter Finals");
  assert.equal(of("semifinals", "Semifinals"), "Semi-Finals");
  assert.equal(of("third_place", "Third Place"), "Fight for 3rd Place");
  assert.equal(of("championship", "Championship"), "Championship");
});

test("a round-robin match reads as Elimination plus its bracket", () => {
  const label = stageLabel({ stageKey: "pools", stageName: "Pool Stage", groupName: "B", groupOrder: 1 });
  assert.equal(label.stage, "Elimination");
  assert.equal(label.bracket, "Bracket 2");
  assert.equal(label.full, "Elimination · Bracket 2");
});

test("a court always reads as something", () => {
  assert.equal(courtLabel("Court 4"), "Court 4");
  assert.equal(courtLabel(null), "Court TBA");
  assert.equal(courtLabel("   "), "Court TBA");
});

test("match numbers run 1..N across stages, by bracket order not by group id", () => {
  const ctx = {
    stageSequenceById: new Map([["pools", 1], ["semis", 2]]),
    // Bracket order deliberately disagrees with the alphabetical order of the ids.
    groupOrderById: new Map([["zzz-first", 0], ["aaa-second", 1]]),
  };
  const numbers = continuousMatchNumbers(
    [
      { id: "s2", stageId: "semis", groupId: null, matchNumber: 2 },
      { id: "b2m1", stageId: "pools", groupId: "aaa-second", matchNumber: 1 },
      { id: "b1m2", stageId: "pools", groupId: "zzz-first", matchNumber: 2 },
      { id: "s1", stageId: "semis", groupId: null, matchNumber: 1 },
      { id: "b1m1", stageId: "pools", groupId: "zzz-first", matchNumber: 1 },
    ],
    ctx,
  );

  assert.deepEqual([...numbers.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id), [
    "b1m1",
    "b1m2",
    "b2m1",
    "s1",
    "s2",
  ]);
  assert.deepEqual([...numbers.values()].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test("numbering is stable as TBD knockout slots fill in", () => {
  const ctx = {
    stageSequenceById: new Map([["pools", 1], ["semis", 2]]),
    groupOrderById: new Map([["g", 0]]),
  };
  const all = [
    { id: "p1", stageId: "pools", groupId: "g", matchNumber: 1 },
    { id: "p2", stageId: "pools", groupId: "g", matchNumber: 2 },
    { id: "s1", stageId: "semis", groupId: null, matchNumber: 1 },
    { id: "s2", stageId: "semis", groupId: null, matchNumber: 2 },
  ];
  const before = continuousMatchNumbers(all, ctx);
  const after = continuousMatchNumbers([...all].reverse(), ctx);
  assert.deepEqual([...before.entries()].sort(), [...after.entries()].sort());
  assert.equal(before.get("s2"), 4, "the last semifinal keeps the number it was printed with");
});
