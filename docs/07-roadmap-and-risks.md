# Roadmap, Risks & Edge Cases

---

## Implementation phases

| Phase | What | Needed for the first tournament? | Status |
|---|---|---|---|
| **1** | **Engine** (pure TS, test-first): format registry, round robin, single elimination, standings with configurable tiebreakers, qualification resolver, stage wiring, validation suite | ✅ | **Done** — `packages/engine`, 46 tests |
| **2** | **Data layer**: Supabase project, schema migrations, RLS policies, typed client, seed from template | ✅ | **Done** — `packages/db`, project `pakangers-tournament`, real tournament seeded in `draft` |
| **3** | **Organizer console**: passcode gate, setup wizard, players, teams, groups, stages, lock | ✅ | **Done** — `apps/web`, live at pakangers-app.vercel.app |
| **4** | **Score entry**: match list, per-game entry, derive → recompute → populate, edit with audit log, forfeits | ✅ | Not started |
| **5** | **Public view**: live/upcoming/completed, standings, bracket, results, QR, realtime | ✅ | Not started |
| 6 | **Scheduling**: courts, ordering, greedy auto-assign with conflict + rest checks, manual override | ❌ | Not started |
| 7 | **Rules module**: rule sets, per-tournament selection, curated summaries with links | ❌ | Not started |
| 8 | **DUPR export**: CSV in DUPR template shape, eligibility flags, submission records | ❌ | Not started |
| 9 | **Templates**: save-as-template, create-from-template, seed the three starter templates | ❌ | Partial — 3 starter templates seeded; save-as-template UI not built |
| 10 | **Hardening**: offline score queue, full dry run, printable standings and bracket | ✅ (partial) | Not started |

**Phases 1–5 plus the offline queue and a dry run are what the first tournament actually requires.**
Everything else can land afterward without disrupting a live event.

Design work (this pass) sits ahead of Phase 3 and shapes Phases 3–5.

**Scope note on the Phase 3 build:** the setup wizard's "Stages & scoring" step is read-only —
it displays what the template pre-filled but doesn't yet let the organizer edit scoring, add
stages, or rewire the crossover-semifinal slot references from the UI (that's the hardest screen
flagged in `06-design-brief.md`, and it deserves dedicated design attention rather than a rushed
first pass). Changes to stage configuration go through the database directly for now. Multi-division
tournaments also aren't wired up yet — `instantiateFromTemplate` only reads `config.divisions[0]`.
Both are natural Phase 3 follow-ups, not blockers for running the first tournament, since the
seeded Pakangers config is already correct.

---

## The go / no-go gate

> If Phases 1–5 are not complete **and dry-run tested** before the event date, run the Pakangers
> tournament on **Global Pickleball Network** (free) and keep building without deadline pressure.

This decision gets made calmly, in advance — never at the venue with players waiting. It costs
nothing to hold in reserve, and having it written down here is what makes it easy to take.

---

## Risks

### Tournament-day failure is unrecoverable in the moment
You can't debug while 18 people wait. Mitigations, all of them cheap:
- Managed hosting — the event never depends on a laptop staying awake
- Offline queue for score entry — dropped wifi doesn't lose a result
- Printable bracket and standings as a paper backup
- The fallback platform decided in advance

### Circular ties
Three teams at 2–1 where head-to-head forms a cycle. The engine must detect it, fall through to the
next criterion, and if still tied, **ask the organizer** rather than sorting arbitrarily. Silent
arbitrary ordering is how tournaments get arguments.

### Unequal schedules across pools (the 4+5 case)
With 9 teams, one pool plays 4 matches per team and the other plays 3. Within-pool ranking is fine.
**Across pools, raw win counts aren't comparable** — relevant only if a configuration seeds across
pools or uses wildcards, in which case the tiebreaker list should lead with `win_percentage`. The
engine should warn when it detects this.

### Retroactive configuration edits
Changing a stage's scoring after matches in it have been played. Solved by snapshotting
`scoring_config` onto each match at creation, so history keeps the rules it was played under.

### Score corrections cascading downstream
A corrected pool score can change who qualified after the semifinals are already populated. The
engine detects the downstream invalidation and **blocks the save behind an explicit confirmation**
naming the affected teams and matches. Never a silent rewire.

### Withdrawals mid-tournament
Needs an explicit policy, not an improvised one. Phase 4 implements forfeit-at-configured-score for
the withdrawing team's remaining matches. The alternative — voiding all their results — distorts
everyone else's point differential and should not be the default.

### Missing DUPR IDs
Expect most club players to have none. The export must degrade gracefully and report exactly which
matches are unsubmittable and which player is the cause.

### Shared passcode
Right for a club at this scale, but it gives no per-person accountability beyond the typed name.
Revisit if the platform is used beyond the club or by people who don't all trust each other.

### Rulebook copyright
Never paste USA Pickleball rulebook text into the app. Organizer-written summaries plus links only.

### Scope creep
Double elimination, multi-division, Swiss, and auto-scheduling are **designed for and not built**.
The format registry interface is the guarantee that adding them later is cheap. The risk is building
them now, before a single tournament has been run on the system.

---

## Verification plan

How the build gets proven before it touches a real event:

1. **Engine unit tests** — round robin round counts and pairings for n = 4, 5, 8, 9, 10; bracket bye
   padding for non-power-of-two entrants; each tiebreaker in isolation; the three-way circular tie;
   every validation code.
2. **Seed check** — create the Pakangers tournament from its template; confirm two groups, correct
   sizes at both 9 and 10 teams, and RR-to-11 / knockout-to-15 stage configs.
3. **Full dry run** — enter fabricated scores for every pool match; verify standings order against a
   hand calculation; verify semifinals populate as A1–B2 and B1–A2; complete them; verify third
   place and championship populate from the correct winners and losers.
4. **Invalidation check** — correct a pool score after semifinals populate; confirm the warning
   dialog appears rather than a silent rewire.
5. **Public page on a real phone** — private window, no login prompt, correct live data, legible at
   375px, QR resolves.
6. **Invalid configs** — 3 qualifiers from a 2-team group, `pointsToWin: 0`, a player on two teams.
   Each must produce a specific explanatory message, not a crash.
7. **DUPR export** — confirm shape against DUPR's downloaded template; confirm missing-ID matches are
   flagged, not silently dropped.
8. **Offline test** — enter a score with the network disabled; confirm it queues, shows pending
   state, and syncs on reconnect.
