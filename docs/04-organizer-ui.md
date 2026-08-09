# Organizer Console — Screen Specification

**Route namespace:** `/admin` (tournament list, create new) and `/admin/[slug]` (a specific tournament)
**Access:** one shared organizer passcode gates the whole `/admin` area — not one per tournament.
On unlock, the organizer types their name once per session; that name is attached to every score
they record. The same passcode carries across every tournament ever run on this deployment, which
is what makes creating tournament #2 next year frictionless instead of another setup step.

---

## The governing constraint

> The organizer is **standing at a court, holding a phone in one hand**, with players waiting.

Everything below is subordinate to that. Big tap targets. No hover-dependent interactions. No
horizontal scrolling. Score entry reachable in one tap from anywhere. Nothing important behind a
menu.

There is a second, calmer mode — setup the night before, on a laptop — but if the two conflict,
**the phone at the court wins.**

---

## Screen inventory

| # | Screen | When used | Priority |
|---|---|---|---|
| A0 | Passcode unlock | Every session | High |
| A1 | Tournament list — create / open / duplicate | Start of every tournament's life, and on and off during it | High |
| A2 | Tournament dashboard | Constantly during event | **Highest** |
| A3 | Setup wizard (7 steps) | Before the event | High |
| A4 | Players | Before the event | Medium |
| A5 | Teams | Before the event | High |
| A6 | Groups & draw | Before the event | High |
| A7 | Stages & scoring | Before the event | High |
| A8 | Schedule | Before + during | Medium |
| A9 | Match list | Constantly during event | **Highest** |
| A10 | Score entry | Constantly during event | **Highest** |
| A11 | Standings (organizer view) | During event | High |
| A12 | Bracket (organizer view) | During event | High |
| A13 | Rules | Rarely | Low |
| A14 | DUPR export | After the event | Low |
| A15 | Audit log | Rarely, when disputed | Low |

The three marked **Highest** are the tournament-day product. If design time is limited, spend it
there.

---

## A0 — Passcode unlock

Single field, numeric keypad, large. Then "Your name" so the audit trail has an actor.

**States:** empty · wrong passcode (inline, non-punitive) · unlocked
**Note:** session persists on the device so the organizer isn't re-entering it between matches.

---

## A1 — Tournament list

**This is the answer to "how do I reuse this for a new tournament."** `/admin` — the landing screen
after unlock, and reachable from every other admin screen. Nothing before this document actually
specified how a second tournament comes into existence; this screen is that specification.

**Content:** every tournament ever run on this deployment — name, date, venue, status badge, newest
first. Tapping one opens its dashboard (A2); a tournament still in `draft` opens straight back into
the setup wizard (A3) wherever it was left off.

**Primary action: "+ New tournament."** Two paths:

1. **Start from a template** — the seeded starter templates ("Pakangers — 2 Pools + Top 4", "Single
   Elimination 16", "Doubles RR 8"), or any tournament previously saved as a template (see below).
   Copies that template's `division` / `stage` / `qualification_rule` / scoring / tiebreaker
   configuration into a **brand-new** `tournament` row, then drops straight into the setup wizard
   (A3) with everything pre-filled and fully editable — rename groups, resize pools, change scoring,
   swap the format, all before locking.
2. **Start blank** — same wizard, nothing pre-filled.

**"Save as template"** is the other half of reuse, and lives as an action on A7 (Stages & scoring):
takes the *current* tournament's configuration and stores it as a new template, named by the
organizer ("Pakangers — 2 Pools + Top 4, 2026 edition"). This is how next year's tournament gets
built from *this* year's actual, battle-tested configuration rather than only the three generic
starters — the platform's own history becomes its template library over time.

**Why this is safe to reuse repeatedly:** every table in the schema is keyed by `tournament_id` (see
`03-data-model.md`). Tournaments never share rows. Creating and editing tournament #2 cannot touch
tournament #1's stored results, standings, or audit log — a completed tournament, once archived, is
permanent. Duplicating a template only ever copies *configuration*, never players, teams, or scores.

**States:** empty (first-ever use — just the "+ New tournament" prompt, no list yet) · populated ·
a `draft` tournament shows "Resume setup" instead of "View" · an `archived` tournament opens
read-only, useful for looking up last year's results while building this year's.

---

## A2 — Tournament dashboard

The home base. Answers "what do I do next?" in under two seconds.

**Content, in priority order:**
1. Tournament name, date, status badge
2. **Progress**: "12 of 20 pool matches complete" with a visual bar
3. **Next up**: the next 2–3 unplayed matches, each with a one-tap "Enter score"
4. **Needs attention**: unresolved ties, validation warnings, unassigned teams — only shown when
   non-empty
5. Quick links: Matches · Standings · Bracket · Share public link / QR
6. Current stage indicator: which stage is live, what's blocking the next one

**States:**
- `draft` — setup incomplete; dashboard becomes a checklist of remaining setup steps
- `locked` — ready to start; a single prominent "Start tournament" action
- `in_progress` — as described above
- `completed` — final results, podium, DUPR export prompt

---

## A3 — Setup wizard

Seven steps, linear, resumable, each independently editable afterward. Progress is visible; the
organizer can leave and come back.

```
1 Tournament info  →  2 Players  →  3 Teams  →  4 Groups
   →  5 Stages & scoring  →  6 Tiebreakers & qualification  →  7 Review & lock
```

**Step 7 (Review & lock)** is the important one: it runs the full validation suite and shows every
blocking issue and warning in plain language, with the specific entity named and a link to fix it.
Locking is disabled while blocking issues exist. Warnings are acknowledged with a checkbox, not
blocked.

**Start-from-template option** appears at step 1 and pre-fills steps 4–6.

---

## A4 — Players

List with search. Add / edit / remove.

**Per player:** name, optional contact, optional DUPR ID, optional skill rating.

**Design note:** the DUPR ID field must feel genuinely optional — most club players don't have one,
and the interface should not imply something is wrong when it's blank. A short inline explanation of
what it's for, and nothing more.

**Bulk add** (paste a list of names, one per line) is the fastest path for 18 players and should
exist.

**States:** empty (with a clear first action) · populated · unassigned-players warning after teams
are built

---

## A5 — Teams

The screen where pairing happens.

**Content:** list of teams; each shows team number, name, its members, seed, and assigned group.

**Actions:** create team · rename · add player · remove player · **swap players between teams** ·
set seed · assign group · auto-generate teams · lock all teams.

**Swap is the interaction that matters.** Organizers change their minds about pairings repeatedly
right up to lock. It should take two taps, not a delete-and-recreate cycle.

**Live validation panel**, always visible, updating as changes are made:
- ✅ 18 of 18 players assigned
- ⚠️ Team 7 has only 1 player
- ❌ Maria Cruz is on Team 3 and Team 8

**States:** empty · partial · complete · locked (fields become read-only with a clear unlock path)

---

## A6 — Groups & draw

**Content:** the configured groups, each a named container of teams. Group names are **editable free
text** — the UI must never present "A" and "B" as fixed labels.

**Actions:** set number of groups · rename a group · move a team between groups · auto-distribute
(random or seeded snake) · manual assignment.

**Design note:** with 9 teams the split is 4 + 5. The interface should present this as normal and
expected — a quiet note that the 5-team pool plays one extra round — not as an error to resolve.

---

## A7 — Stages & scoring

Where per-stage configuration lives. The screen that makes the platform reusable.

**Content:** an ordered list of stages. Each stage row expands to show:
- Name and format (round robin / single elimination)
- Scoring: points to win · win by 2 vs sudden death · optional cap · best of 1/3/5 · side-out vs rally
- Which groups it contains (for pool stages)
- Where its entrants come from (for knockout stages)

**Actions:** add stage · reorder · delete · duplicate · edit scoring · **save this configuration as a
template** (see A1) — takes everything on this screen plus the division and qualification setup and
stores it for next time, so future tournaments start from what actually worked, not from scratch.

**Design challenge for this screen:** the *entrant wiring* — "Semifinal 1 = Pool A rank 1 vs Pool B
rank 2." This is the most conceptually dense thing in the product and the place a generic form will
feel worst. It wants a visual, connective treatment: two source slots feeding a match box, readable
at a glance, editable without a manual. Getting this screen right is what separates this from every
existing platform, and it deserves disproportionate design attention.

**States:** default (from template) · edited · warning when a stage's scoring is changed after
matches in it have been played.

---

## A8 — Schedule

**Content:** courts, match order, times.

**Actions:** add/remove courts · auto-schedule · manually reorder · assign court · set start time ·
set minimum rest period.

**Conflict display:** any conflict (team double-booked, unavailable court, rest violation) shown
inline on the offending match, in plain language, not as a summary count at the top.

**Phase note:** this is Phase 6. Early versions can run with a simple ordered list and no times at
all — many club tournaments genuinely work that way ("next match on court 2 when it frees up").
Design should not assume timed scheduling is required.

---

## A9 — Match list

The tournament-day workhorse, alongside A10.

**Content:** all matches, filterable by `Live · Upcoming · Completed`, and by stage/group.

**Each row shows:** match number · both team names · court · status · score if completed.
**Each row's primary action:** enter or edit the score. One tap.

**Design notes:**
- Default filter should be **Upcoming**, because that's what the organizer needs next.
- Completed matches must be easy to find and re-open — corrections happen constantly.
- Team names must be readable at a glance; truncation on a phone is a real risk with doubles pairs,
  and the design needs a considered answer (initials? stacked player names? team number as the
  primary identifier?).

**Secondary action: "Add match".** This is the manual-match escape hatch from the engine doc (§6) —
for a forfeit replacement, an exhibition game, or an extra decider the auto-generated set didn't
anticipate. It should exist but stay visibly secondary to the generated list: a single action at the
bottom of the screen, not a button competing with the match rows. The flow: pick two teams, pick the
stage it counts toward (or "doesn't count"), scoring config pre-fills from that stage and stays
editable, optional reason text, optional "replaces Match #N" which marks the original as superseded
rather than deleting it.

**States for a manually-added match:** shown in the list with a small "manual" tag so it's never
confused with a generated one, and its own edit trail same as any other match.

---

## A10 — Score entry

The single most-used screen. Should be usable one-handed, in sunlight, in under ten seconds.

```
MATCH #12  ·  Pool A  ·  First to 11, sudden death

  Team Alpha        [ 11 ]
  Team Bravo        [  8 ]

  Recorded by: Jes

  [ SAVE RESULT ]
```

**Requirements:**
- Large numeric inputs, or steppers — whichever tests better one-handed. Consider both.
- The scoring rule is **displayed on the screen**, so the organizer sees "first to 11, sudden death"
  while entering. This prevents the most common data-entry error.
- Best-of-3/5 shows one score pair per game, appearing progressively.
- Inline validation before save: an impossible score is caught here, with a specific message —
  "Sudden death at 11: a score of 11–10 isn't possible in this stage."
- Forfeit / default / retired available, but secondary — not competing with the numbers.

**On save:**
1. Winner determined
2. Match marked complete
3. Standings recalculated
4. Bracket populated if this result resolves a slot
5. Audit entry written
6. Confirmation, then **return to the match list with the next match ready** — not a dead-end screen

**Edit mode** is the same screen with existing values, plus a visible "this was previously recorded
as 11–8 by Jes at 2:14pm."

**The downstream-invalidation dialog** lives here: when editing a completed pool score would change
who qualified for an already-populated knockout stage, saving is interrupted by an explicit
confirmation naming the affected teams and matches. This dialog is rare, high-stakes, and must be
impossible to dismiss accidentally.

---

## A11 — Standings (organizer view)

Same data as the public view, plus:
- The active tiebreaker order shown explicitly, so the organizer can explain a placement to a player
- **Unresolved ties flagged**, with a resolution action
- A per-team expansion showing the matches behind the numbers

Columns: Team · W-L · Point Diff · Points For · (whatever else the tiebreaker config uses)

**Design note:** on a phone, five numeric columns plus a doubles team name will not fit. Solving this
legibly — priority columns, an expandable row, a card layout — is a real design problem, and it
applies to A11 and the public standings equally.

---

## A12 — Bracket (organizer view)

Visual knockout bracket: semifinals → final, with the third-place match shown alongside.

Unresolved slots show their **source**, not a blank: "Pool A — 1st" rather than "TBD". This is more
informative and it makes the wiring legible to everyone.

Tapping a match opens score entry.

**Design challenge:** brackets are inherently wide and phones are narrow. Needs a genuine answer —
vertical stacking by round, pinch-zoom, or a rethought layout. Don't inherit the desktop tree by
default.

---

## A13 — Rules

Two clearly separated sections:

1. **Official rules** — which rule set this tournament uses ("USA Pickleball Official Rules — 2026"),
   with the organizer-written summary points and links to the official source. Never full text.
2. **Tournament-specific rules** — free-form entries the organizer writes: scoring per stage, timeout
   policy, warm-up, dress code, disputes.

Editable. Appears read-only on the public page.

---

## A14 — DUPR export

**Content:** all completed matches with a per-match submission status.

- ✅ Ready — all four players have DUPR IDs
- ⚠️ Not eligible — names the specific player missing an ID, with a link to add it
- ⬇️ Export CSV (DUPR template shape)

Plus a summary: "24 of 30 matches ready. 6 blocked by 3 players missing DUPR IDs."

**Design note:** this screen's job is to make the *blocked* rows actionable, not to celebrate the
ready ones.

---

## A15 — Audit log

Chronological list of every score change: what changed, from what to what, by whom, when.

Read-only. Filterable by match. Exists for exactly one purpose — settling a dispute — and should be
findable when that happens and invisible otherwise.

---

## Cross-cutting requirements

- **Offline tolerance on score entry.** Venue wifi is unreliable. A saved score must queue locally
  and sync, with clearly visible pending state. Never lose a result to a dropped connection.
- **No destructive action without confirmation.** Deleting a team, unlocking a tournament, editing a
  score that invalidates downstream matches.
- **Every error names the specific thing.** Not "invalid configuration" — "Pool B has 2 teams but 3
  qualifiers are configured to advance."
- **Sunlight legibility.** Outdoor courts. High contrast is a functional requirement, not a
  preference.
