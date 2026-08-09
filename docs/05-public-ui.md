# Public Player Page — Screen Specification

**Route:** `/t/[slug]`
**Access:** open URL and QR code. **No account. No login. No app install. No email capture.**

---

## The governing constraint

> A player has just finished a match, is sweaty, holding a phone, and wants to know **one thing**:
> *when do I play next, and where do I stand?*

They will open this page dozens of times over a few hours, for a few seconds each time. It is a
glanceable read surface, not an application. Every design decision should reduce the time from tap
to answer.

Nothing on this page is interactive except navigation. No accounts, no scores to enter, no settings.

---

## Screen inventory

| # | Screen | Priority |
|---|---|---|
| P0 | Landing / Now | **Highest** |
| P1 | Matches (Live · Upcoming · Completed) | **Highest** |
| P2 | Standings | **Highest** |
| P3 | Bracket | High |
| P4 | Teams & players | Medium |
| P5 | Rules | Low |
| P6 | Final results | High (only at the end) |

---

## P0 — Landing / Now

The default view. Should answer the two questions above without any navigation.

**Content, in priority order:**
1. Tournament name, logo, date, venue — compact, not a hero banner eating the screen
2. **Live now** — matches in progress with current status and court
3. **Up next** — the next few matches with court assignments
4. Compact standings snippet (top of each group) with a link to full standings
5. Navigation to the other views

**When the tournament is complete**, this becomes the final results / podium view (P6).

**Design note:** resist the instinct to make this a marketing page for the tournament. The player
already knows what tournament they're at. Information density beats branding here.

---

## P1 — Matches

Three tabs or filters: **Live · Upcoming · Completed**

**Each match row:** match number · both team names · court · time or status · score if completed.

Grouped by stage and group. Clear visual distinction between a pool match and a knockout match.

**Design notes:**
- **Live matches need to feel live** — a subtle indicator, not a blinking distraction.
- Completed matches show the final score prominently; that's what people scan for.
- Team names for doubles are two people. How they render at 375px width — full names, initials,
  stacked, team name only — is a real decision that affects every screen in this document.

---

## P2 — Standings

Per group, ranked, with a visible indicator of which teams are currently in a qualifying position.

**Columns:** Rank · Team · W-L · Point Diff · Points For

**Two things this screen must do that most don't:**

1. **Show the qualification line.** A visual divider between the teams currently advancing and those
   not. This is the single most-wanted piece of information in a pool stage and almost every
   platform buries it.
2. **State the tiebreaker order in plain language**, somewhere accessible: "Ties broken by: point
   differential, then points scored." Players ask. Making it visible prevents arguments.

**Design challenge:** five columns plus a doubles team name does not fit a phone. This needs a real
answer — priority columns with an expandable row, or a card layout, or a rethink of which numbers
actually matter at a glance. Whatever is chosen applies to the organizer standings view too.

---

## P3 — Bracket

The knockout tree: semifinals → final, with the third-place match.

Unresolved slots show their **source** — "Pool A — 1st" — not "TBD". More informative, and it lets a
player still in the pool stage see exactly what they're playing for.

Completed matches show scores. The eventual champion is visually distinct.

**Design challenge:** same as the organizer bracket. Brackets are wide, phones are narrow. Vertical
stacking by round is likely the answer, but it's worth exploring properly rather than defaulting to a
scaled-down desktop tree.

---

## P4 — Teams & players

The roster. Each team: number, name, its players, group assignment, seed.

Low-frequency but genuinely useful — players look up who they're about to face.

---

## P5 — Rules

Read-only mirror of the organizer's rules screen:

1. **Official rules** — which rule set applies, the organizer's summary points, and a link to the
   official USA Pickleball source. Never full rulebook text.
2. **Tournament-specific rules** — scoring by stage, timeouts, warm-up, disputes.

**The scoring-by-stage table is the part players will actually read**, because "is the semifinal to
11 or 15?" is asked at every tournament. It should be near the top and impossible to miss.

---

## P6 — Final results

Shown when the tournament completes; replaces P0 as the landing view.

**Content:**
- Champion, runner-up, third place — a podium treatment is appropriate here, and this is the one
  screen where a little celebration is warranted
- Final standings for every group
- Complete match archive
- The bracket in its final state

This is the screen people screenshot and share. It's worth making it look good.

---

## Cross-cutting requirements

- **Mobile-first, genuinely.** Design at 375px and scale up. Not a desktop layout that reflows.
- **Live updates** via Supabase realtime, so a score entered at the organizer's phone appears here
  within seconds without a manual refresh. A visible "updated just now" beats a spinner.
- **Fast first paint.** Opened dozens of times for a few seconds each. Cold-load performance is a
  feature.
- **Works on old phones and bad wifi.** Venue conditions. Assume the worst network in the building.
- **Sunlight legible.** Outdoor courts. High contrast is functional.
- **QR-friendly entry.** The organizer prints a QR that lands here. First impression is a scan, not a
  typed URL — so the landing view must make sense with zero context.
- **Shareable.** Open Graph metadata so the link previews properly when pasted into the club's group
  chat, which is exactly how it will spread.
- **No dead ends.** Every screen reachable from every other in one tap.
