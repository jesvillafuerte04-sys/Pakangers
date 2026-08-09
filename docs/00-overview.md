# Pakangers Tournament Platform — Overview

## What this is

A reusable, **configuration-driven** pickleball tournament management platform.

The Pakangers club tournament (18 players / 9 doubles teams, possibly 20/10) is the **first stored
configuration**, not the shape of the product. Nothing about that event — two pools, top-two
advancing, 11-point pool games, 15-point knockout games — is written into the code. It all lives in
data, so the next tournament can be singles, four pools, best-of-three, or a different tiebreaker
order without a developer touching anything.

## The one-sentence test

> If a future tournament needs a different number of groups, a different scoring rule per stage, or
> a different tiebreaker order, the organizer changes a **setting** — not a line of code.

Every design decision in these documents is downstream of that sentence.

## Two audiences, two surfaces

| | Organizer console | Public player page |
|---|---|---|
| Who | You and any co-organizers | Every player, spectator, family member |
| Access | Shared organizer passcode | Open URL + QR code, **no accounts, no login** |
| Device | Phone, standing at the venue | Phone, mostly |
| Does what | Sets up the tournament, enters every score | Reads standings, brackets, schedule, results |
| Frequency | Constant during the event | Constant during the event |

Both are mobile-first. The organizer is on their feet holding a phone in one hand — that constraint
drives the entire interface, and it is the single most important thing for the design phase to
respect.

## The tournament lifecycle

```
Registration → Team Formation → Configuration → Draw Generation
     → Scheduling → Score Entry → Standings → Knockout → Champion → DUPR Export
```

The organizer moves left to right. The public page reads from the middle onward.

## Key decisions already made

- **Stack**: Next.js PWA + Supabase (managed Postgres) on Vercel. Managed hosting so the event never
  depends on a laptop staying awake at the venue.
- **Deployment**: source lives on **GitHub**, deployed to **Vercel** via its GitHub integration.
  **Nothing is self-hosted** — no server to run, no machine to keep awake. Push to `main` deploys.
  See `08-deployment.md` for what this constrains.
- **Auth**: one shared organizer passcode. Whoever enters a score types their name, which lands in
  the audit log.
- **DUPR**: CSV export shaped to DUPR's import template. The tournament never depends on DUPR being
  reachable. Partner-API submission is designed for but not built.
- **Scope**: ship what the first tournament needs, on top of the generic engine. Double elimination,
  multi-division, and auto-scheduling are *designed for* and *not built yet*.
- **Fallback**: if the build isn't dry-run tested before the event date, run the event free on
  Global Pickleball Network and keep building without deadline pressure.

## Document map

| Doc | What's in it | Who needs it |
|---|---|---|
| `00-overview.md` | This page | Everyone |
| `01-research.md` | 2026 rules, DUPR, competitor comparison, algorithms | Decision record |
| `02-tournament-engine.md` | Formats, standings, qualification, validation | Engineering |
| `03-data-model.md` | Every table and field | Engineering |
| `04-organizer-ui.md` | Every organizer screen, state by state | **Design** |
| `05-public-ui.md` | Every public screen, state by state | **Design** |
| `06-design-brief.md` | Tone, constraints, what to decide | **Design** |
| `07-roadmap-and-risks.md` | Phases, edge cases, what goes wrong | Everyone |
| `08-deployment.md` | GitHub → Vercel, secrets, what serverless constrains | Engineering |

**For the UI design pass, start with `06-design-brief.md`, then `04` and `05`.**
