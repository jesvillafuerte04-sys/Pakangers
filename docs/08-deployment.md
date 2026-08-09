# Deployment

**Source on GitHub → deployed to Vercel. Nothing is self-hosted.**

There is no server to run, no machine to keep awake, and no laptop at the venue that the tournament
depends on. Push to `main`, Vercel builds and deploys.

---

## The pieces

| Piece | Where it lives | Who runs it |
|---|---|---|
| Application code | GitHub repository | You |
| Web app (Next.js) | Vercel | Vercel |
| Database (Postgres) | Supabase | Supabase |
| Auth (organizer passcode) | Our own code, hash stored in Supabase | — |
| Realtime updates | Supabase Realtime | Supabase |

Two managed services, one repo. That's the whole operational surface.

---

## Flow

```
local machine  →  git push  →  GitHub  →  Vercel build  →  live URL
                                  │
                                  └─ pull request → preview deployment (own URL)
```

- **`main` → production.** The URL players scan at the tournament.
- **Any branch or PR → preview deployment** at its own URL, with its own build. This is how a change
  gets tested without touching the live tournament — genuinely useful mid-event if something needs
  fixing.
- Rollback is a click in Vercel: redeploy the previous build. Worth knowing *before* the event, not
  during.

---

## Repository

Private is fine and costs nothing on either service. Public is also fine — **provided the secrets
rule below is followed**, since a public repo means anyone can read every file in it.

```
/
├─ apps/web/          Next.js app (organizer + public)
├─ packages/engine/   Pure tournament engine — no DB, no UI
├─ packages/db/       Supabase client, typed queries, migrations
├─ docs/              These documents
└─ README.md
```

Vercel needs its **Root Directory** set to `apps/web` in project settings, since this is a monorepo.

---

## Secrets — the one rule that matters

> **Never commit a key. Ever. Not in a config file, not in a comment, not "temporarily".**

All secrets live in **Vercel environment variables**, set through the Vercel dashboard, never in the
repo. `.env*` files are gitignored from the first commit.

| Variable | Exposure | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public — shipped to the browser | Safe. Not a secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public — shipped to the browser | Safe **only because** row-level security restricts what it can read. RLS is doing the actual protection here. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Bypasses all row-level security. Must never appear in client code or in any variable prefixed `NEXT_PUBLIC_`. |
| `ORGANIZER_PASSCODE_HASH` | Server only | **Deployment-level, not per-tournament.** One passcode gates all of `/admin`, across every tournament this club ever creates — see `03-data-model.md` and `04-organizer-ui.md` A1. Rotate it by generating a new hash and updating the Vercel env var; no database migration needed. |

The `NEXT_PUBLIC_` prefix in Next.js means "bake this into the JavaScript sent to every browser."
Anything without that prefix stays on the server. Getting this wrong is the single most likely way to
leak database access, so it's worth stating plainly.

**If a key is ever committed by accident:** rotate it in Supabase immediately. Deleting the commit is
not sufficient — GitHub retains history, and the key must be assumed compromised.

---

## What serverless constrains

Vercel runs functions on demand. There is no always-on process. This affects a few things in the
plan, all of them manageable:

| Constraint | Consequence here |
|---|---|
| No long-running background jobs | Fine — the engine computes standings on request in milliseconds. Nothing needs a worker. |
| No persistent in-memory state between requests | Fine — Supabase holds all state. The engine is pure, so it has none to hold. |
| No writing to the local filesystem | The DUPR CSV is **generated per request and streamed to the browser**, not written to disk. |
| Function execution time limits | Never an issue at this scale, but bulk operations should stay request-sized. |
| Cold starts | First request after idle is slower. Matters for the public page, which is opened repeatedly in short bursts — favour static rendering and client-side realtime over server-rendering everything. |

**Supabase Realtime, not polling.** The live-update requirement is served by Supabase's realtime
subscription from the browser directly. Don't build a polling loop against Vercel functions.

---

## Free tier reality check

For an 18-player tournament this sits comfortably inside both free tiers — a few hundred rows and a
few thousand requests over an afternoon. No cost concern at this scale, or at ten times it.

**One thing to know:** Supabase pauses free projects after a period of inactivity. A project left
untouched between tournaments may need waking up. **Check the database is awake the day before the
event**, not an hour before it starts. Worth adding to the pre-tournament checklist.

---

## Pre-tournament deployment checklist

Run this the **day before**, not the morning of:

- [ ] Production deploy is green on Vercel, from the intended commit
- [ ] Supabase project is awake and responding
- [ ] Public URL opens on a phone, on cellular data, in a private window — no login prompt
- [ ] QR code resolves to the correct tournament
- [ ] Organizer passcode works on the phone that will be used
- [ ] A test score can be entered and appears on the public page within seconds
- [ ] Standings and bracket printed as paper backup
- [ ] The previous good deployment is identified in Vercel, in case a rollback is needed
- [ ] Fallback decision made: is the platform ready, or does this run on Global Pickleball Network?

---

## What this rules out

Because deployment is GitHub → Vercel, these are off the table and shouldn't appear in any design or
implementation:

- Any always-on server process, queue worker, or cron daemon of our own
- Storing anything on the app server's filesystem
- WebSocket servers we run ourselves (Supabase Realtime handles this)
- SQLite or any file-based database
- Long-running scheduled jobs
