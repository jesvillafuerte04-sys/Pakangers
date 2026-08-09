# Tournament Engine Design

The engine is a **pure TypeScript package** with no database imports and no React imports. It is a
function of `(configuration, completed results)`. Everything else in the product is a viewer or an
editor over it.

This matters practically: standings, bracket population, and qualification are **derived on read**.
A corrected score is just a new input, never a cascade of manual fixes.

---

## 1. The anti-hardcoding rules

Three rules keep this from quietly becoming a Pakangers-specific app:

1. **No literal `"A"`, `"B"`, `2`, `11`, or `15` anywhere in engine code.** Groups are data rows.
   Counts and scoring come from stage configuration.
2. **Stages are a list, not an enum.** "Semifinals" is a row with a format and a scoring config —
   not a screen, not a case in a switch statement.
3. **Formats are registered strategies.** Adding double elimination means adding a file.

---

## 2. Format registry

```ts
interface TournamentFormat {
  key: string
  validate(cfg: StageConfig, entrants: Entrant[]): ValidationIssue[]
  generateMatches(cfg: StageConfig, entrants: Entrant[]): PlannedMatch[]
  computeStandings(cfg: StageConfig, matches: Match[]): Standing[]
  resolveAdvancement(cfg: StageConfig, matches: Match[]): Advancement[]
}
```

**Registered at launch:** `round_robin`, `single_elimination`
**Later registrations, same interface:** `double_elimination`, `swiss`, `consolation`, `ladder`

---

## 3. Scoring configuration

```ts
type ScoringConfig = {
  pointsToWin: number                    // 11, 15, 21…
  winBy: 'win_by_two' | 'sudden_death'
  cap?: number                           // e.g. to 11, win by 2, hard cap at 15
  bestOf: 1 | 3 | 5
  scoringType: 'side_out' | 'rally'      // rally scoring formalized in the 2026 rulebook
}
```

Attached **per stage**. Snapshotted **per match** at creation.

> **Why snapshot?** If the organizer edits the semifinal scoring config after a semifinal has been
> played, the played match must keep the rules it was played under. Without the snapshot, a config
> tweak retroactively invalidates history. This is a one-line decision that prevents a whole class
> of tournament-day disputes.

### The first tournament, expressed as config

| Stage | pointsToWin | winBy | bestOf |
|---|---|---|---|
| Pools (A, B) | 11 | sudden_death | 1 |
| Semifinals | 15 | sudden_death | 1 |
| Third place | 15 | sudden_death | 1 |
| Championship | 15 | sudden_death | 1 |

Nothing here is special-cased. A different tournament fills the same table with different numbers.

---

## 4. Standings engine

```ts
type Tiebreaker =
  | 'match_wins'
  | 'win_percentage'
  | 'head_to_head'
  | 'point_differential'
  | 'points_scored'
  | 'points_allowed'
  | 'games_won'
  | 'coin_flip'
```

An **ordered array** in the stage's `tiebreaker_config`. Applied in sequence; the first criterion
that separates two teams wins.

**The first tournament uses:** `['match_wins', 'point_differential', 'points_scored']`

**A future tournament might use:** `['match_wins', 'head_to_head', 'point_differential', 'points_scored']`

Same code, different array.

### Head-to-head is the tricky one

Head-to-head is computed as a **sub-table over only the tied teams** — not as a global lookup. Three
rules govern it:

1. Only matches between the tied teams count.
2. If the sub-table produces a circular tie (A beat B, B beat C, C beat A), head-to-head **falls
   through** to the next criterion rather than producing an arbitrary order.
3. If every configured criterion is exhausted and teams remain level, the engine **surfaces an
   unresolved tie to the organizer** with a prompt, rather than silently sorting by insertion order.

> Unresolved ties are the single most common source of tournament-day arguments. The engine's job is
> to make the tie *visible and explicit*, not to hide it behind a stable sort.

---

## 5. Stage wiring — the crossover mechanism

A stage's entrants are declared as **slot references**. This is what turns "crossover semifinals"
from a special case into ordinary configuration.

```json
{
  "key": "semifinals",
  "format": "single_elimination",
  "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1 },
  "entrants": [
    { "match": 1,
      "home": { "stage": "pools", "group": "A", "rank": 1 },
      "away": { "stage": "pools", "group": "B", "rank": 2 } },
    { "match": 2,
      "home": { "stage": "pools", "group": "B", "rank": 1 },
      "away": { "stage": "pools", "group": "A", "rank": 2 } }
  ]
}
```

The same structure expresses every layout the requirements asked for:

| Desired bracket | Slot references |
|---|---|
| A1 vs B2 / B1 vs A2 (crossover) | group A rank 1, group B rank 2, … |
| A1 vs A4 / A2 vs A3 (single pool) | all refs point at group A, ranks 1–4 |
| Four quarterfinals | eight refs across however many groups |
| One pool straight to a final | two refs, ranks 1 and 2 |

Third place and championship reference **match outcomes** instead of group ranks:

```json
{ "key": "third_place",
  "entrants": [
    { "match": 1,
      "home": { "stage": "semifinals", "outcome": "loser", "match": 1 },
      "away": { "stage": "semifinals", "outcome": "loser", "match": 2 } } ] }

{ "key": "championship",
  "entrants": [
    { "match": 1,
      "home": { "stage": "semifinals", "outcome": "winner", "match": 1 },
      "away": { "stage": "semifinals", "outcome": "winner", "match": 2 } } ] }
```

---

## 6. Manual match creation

Every match described so far is **generated** by a format from resolved entrant slots — that's what
makes the engine reusable. But real tournaments occasionally need one match that isn't part of that
generated set: a replacement for a forfeit, an exhibition game, an extra decider the organizer calls
on the spot.

This is handled as a distinct, explicit path rather than by loosening the generated one:

```ts
type ManualMatch = {
  tournamentId: string
  stageId: string           // which stage it counts toward, if any
  groupId?: string
  homeTeamId: string
  awayTeamId: string
  scoringConfig: ScoringConfig   // defaults to the stage's config, editable
  reason: string                  // "Forfeit replacement", "Exhibition", freeform
  source: 'manual'                // vs. 'generated' — see below
}
```

Two rules keep this from undermining the generated set it sits alongside:

1. **Every `match` row carries a `source: 'generated' | 'manual'`.** The standings and qualification
   engines only ever fold `generated` matches into automatic recomputation. A manual match is never
   silently swept into a regeneration pass, and never silently double-counted if the stage is later
   regenerated.
2. **A manual match can be scoped in or out of standings.** An exhibition match affects nothing. A
   forfeit replacement should count exactly like the match it replaces — so creating one from "Match
   #7, forfeited" pre-fills the same two teams and stage, and marks the original as superseded rather
   than leaving two conflicting results for the same slot.

In the organizer console this is a single **"Add match"** action, available on the match list and on
a stage, described in `04-organizer-ui.md` (A8). It is deliberately *not* the primary way matches get
created — it's the escape hatch for the case the generator can't anticipate, not a second way to run
the tournament.

---

## 7. Qualification engine

Never "top 2 advance." Instead:

```ts
type QualificationMethod =
  | { method: 'top_n', value: number }        // top 2
  | { method: 'top_percent', value: number }  // top 50%
  | { method: 'threshold', value: number }    // any team with ≥ N wins
  | { method: 'wildcard', value: number }     // best N non-qualifiers across all groups
```

Each rule connects a **source** (stage, optionally a specific group) to a **destination** stage, with
a seeding policy for how qualifiers are ordered on arrival.

The first tournament is two rules: `top_n: 2` from pool A → semifinals, and `top_n: 2` from pool B →
semifinals.

---

## 8. Downstream invalidation

This is the subtle one and it will happen at a real tournament.

An organizer corrects a pool score **after** the semifinals have already been populated. That
correction can change who qualified. The engine must:

1. Recompute standings from the corrected input.
2. Detect that the qualifier set for a downstream stage has changed.
3. **Warn loudly and block the save behind an explicit confirmation**, naming which teams would swap
   and which already-played matches would be invalidated.

It must never silently rewire a bracket mid-event. A visible "this changes who's in the semifinal"
dialog is recoverable; a bracket that quietly reshuffles itself is not.

---

## 9. Validation

Every check returns a structured issue — never a silent failure, never a raw exception in the UI:

```ts
type ValidationIssue = {
  code: string
  severity: 'blocking' | 'warning'
  message: string        // plain language, names the specific thing
  suggestedFix?: string
  entityRef?: { type: string, id: string }
}
```

### Configuration
- fewer teams than the selected format requires
- a group with zero or one team
- odd team count where the format requires even
- qualifiers requested exceed the number of teams in the source group
- knockout entrant count not resolvable to a bracket (shows the bye padding it would use)
- `pointsToWin < 1`; even `bestOf`; cap below points-to-win

### Teams and players
- a player assigned to two teams in the same division
- a team with the wrong number of members for its division's team size
- a team with no players
- a registered player not assigned to any team

### Scores
- winner's score below points-to-win with no cap and no forfeit
- win-by-two configured but the margin is one
- games won inconsistent with the best-of setting
- negative or absurd scores

### Scheduling
- a team scheduled in two concurrent matches
- a match assigned to an unavailable court
- rest period shorter than configured minimum

### Blocking vs warning

**Blocking** issues prevent the tournament from locking. **Warnings** are shown, acknowledged, and
passed. Uneven pools (4 + 5) are a *warning*, not an error — they are normal and legitimate, and the
system should say so rather than fight the organizer about it.

---

## 10. The 4+5 fairness note

With 9 teams split 4 and 5:

- The 5-team pool plays 5 rounds (one team idle per round); each team plays 4 matches.
- The 4-team pool plays 3 rounds; each team plays 3 matches.

**Within a pool, ranking is unaffected** — everyone in that pool played the same schedule.

**Across pools, raw `match_wins` is not comparable** — 3 wins from 4 games is not 3 wins from 3
games. This only matters if a future configuration seeds across pools or uses a wildcard rule. In
those cases the tiebreaker list should lead with `win_percentage` rather than `match_wins`. The
engine should surface this as a warning when it detects a cross-group comparison over unequal
schedules.
