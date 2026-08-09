# Design Brief

**This is the handoff document for the UI design pass.** Read `00-overview.md` first for context,
then `04-organizer-ui.md` and `05-public-ui.md` for the screen-by-screen requirements.

---

## What is being designed

Two surfaces of one product:

1. **Organizer console** (`/admin/[slug]`) — passcode-gated. Setup before the event, score entry
   during it. Used by one to three people.
2. **Public player page** (`/t/[slug]`) — open URL and QR. Read-only. Used by everyone at the venue.

They share a visual system but have genuinely different jobs: one is a tool used under pressure, the
other is a glanceable read surface.

---

## Who uses it, and where

**Physical context, which should drive everything:**

- Outdoors or in a gym. **Bright, often direct sunlight.**
- On foot, phone in one hand, sometimes a paddle in the other.
- Noisy, distracted, players waiting.
- Venue wifi is unreliable.
- Sessions are seconds long, repeated dozens of times over several hours.

**This is not a desktop dashboard product.** It is a phone tool used while standing up. If a design
decision reads well on a laptop but costs a tap at a court, the court wins.

---

## Non-negotiable constraints

| Constraint | Why |
|---|---|
| Mobile-first at 375px | Everyone is on a phone. Design at phone width and scale up. |
| High contrast | Direct sunlight. This is functional, not aesthetic preference. |
| Large tap targets | One-handed, moving, distracted. |
| No hover-dependent interactions | Touch only. |
| No horizontal scroll on the page body | Wide content (brackets, standings tables) scrolls inside its own container. |
| Score entry in one tap from anywhere | The most-repeated action in the product. |
| Public page needs zero login, zero onboarding | Scanned from a QR by someone who has never seen it. |
| Every error names the specific thing | "Pool B has 2 teams but 3 qualifiers configured" — never "invalid configuration". |

---

## The three screens that matter most

If design effort has to be rationed, spend it here. These are the tournament-day product:

1. **A9 — Score entry.** Used more than everything else combined. Must be usable one-handed, in
   sunlight, in under ten seconds, with the scoring rule visible while typing.
2. **A8 / P1 — Match list.** The organizer's next action and the player's "when do I play."
3. **P2 / A10 — Standings.** The most-asked question at any tournament.

---

## The four real design problems

These are genuinely hard and are where a thoughtful design earns its keep. None has an obvious
answer, and the specs deliberately don't prescribe one.

### 1. Doubles team names on a 375px screen
A doubles team is two people. Every match row shows two teams — so potentially four names. Full
names, initials, stacked layout, team number as primary identifier, custom team names? This decision
propagates through every screen in the product. **Solve it first.**

### 2. Standings tables on a phone
Rank, team, W-L, point differential, points for — five columns plus a two-person team name. It does
not fit. Priority columns? Expandable rows? Cards instead of a table? A rethink of which numbers
matter at a glance?

### 3. Brackets on a phone
Brackets are structurally wide; phones are narrow. The default answer — a shrunken desktop tree — is
bad. Vertical stacking by round is probably right, but explore it properly. Unresolved slots show
their source ("Pool A — 1st"), not "TBD", which adds text to already-tight boxes.

### 4. Stage entrant wiring (A6)
The hardest conceptual screen: expressing "Semifinal 1 = Pool A rank 1 vs Pool B rank 2" in a way an
organizer can configure without a manual. A generic form will feel worst here. It wants something
visual and connective — source slots feeding a match box, readable at a glance.

**This screen is the product's actual differentiator.** Every competing platform hardcodes this. If
it's confusing, the whole configurability premise fails at the point of use.

---

## Tone

The tournament is a **club event among friends**, not a sanctioned professional competition. The
interface should feel:

- **Clear and quick** over impressive
- **Confident** — an organizer using it in front of waiting players should look competent, not like
  they're wrestling with software
- **Warm but not cute** — it's a sport among friends, not an enterprise tool and not a toy
- **Celebratory only where earned** — the final results screen (P6) is the one place to let go. That
  screen gets screenshotted and shared. Everywhere else, restraint.

Avoid: dense enterprise-dashboard chrome, aggressive gamification, anything that adds a step between
the organizer and a saved score.

---

## Things that are decided (don't redesign these)

- Two surfaces, two route namespaces, as described above
- Passcode auth for organizers; **no player accounts, ever**
- Group names are **free text** — the UI must never present "A" and "B" as fixed labels
- Scoring, tiebreakers, and qualification are **configurable per stage** and must be presented as
  settings, not as fixed facts
- Standings are computed, so they're always current — no "refresh standings" button
- Rules show organizer-written summaries plus links, never full rulebook text (copyright)

---

## Things that are open

- Colour, type, spacing, the entire visual system
- Light/dark, or both (outdoor use makes this worth thinking about — dark mode in direct sun is
  usually worse, which cuts against the usual default)
- Navigation pattern for each surface — tabs, bottom bar, drawer
- Whether score entry uses numeric keypad input, steppers, or both
- All four problems listed above
- Whether the public page defaults to "Now" or straight to standings
- How live matches are indicated without being distracting

---

## Deliverable

Screen designs for the surfaces in `04-organizer-ui.md` and `05-public-ui.md`, prioritising the three
tournament-day screens and the four hard problems. A visual system (colour, type, spacing,
components) that both surfaces share.

Implementation follows the design — no application code has been written yet, deliberately, so the
design can shape the build rather than the reverse.
