# Turnover Documentation for Claude — Pakangers Tournament Platform

> **Purpose:** This document provides full context, turnover instructions, current state, and the complete specifications (Specs 1 through 7) for Claude to continue development.

---

## 1. Quick Emergency Diagnostic: Why the App May Show an Error Right Now

If the app on Vercel is throwing a database error after the latest commit (`b3890b9`), it is almost certainly due to **an unapplied Supabase SQL migration**:

### The Cause
Commit `b3890b9` added `avatar_url` to the queries in `apps/web`. While the migration file `packages/db/migrations/0011_player_avatar.sql` was committed to Git, **Git pushes to Vercel do NOT automatically apply SQL migrations to your live Supabase database**.

If the Supabase database table `public.player` does not have the column `avatar_url`, Supabase queries like `select id, first_name, last_name, avatar_url from player` will fail with:
`PostgREST error: column player.avatar_url does not exist`.

### The 10-Second Fix in Supabase
Open your [Supabase Dashboard](https://supabase.com/dashboard) -> Select your project -> Go to the **SQL Editor** -> Paste and run:
```sql
ALTER TABLE public.player ADD COLUMN IF NOT EXISTS avatar_url text;
```
As soon as that single line executes, the app will work immediately.

### Alternative: Revert Back to the Previous Working Commit
If you or Claude prefer to roll back to the exact state before this change:
```bash
git revert b3890b9 --no-edit
git push origin main
```
This will immediately restore Vercel to commit `f479af7`.

---

## 2. Codebase Architecture Overview

The repository is a TypeScript monorepo using npm workspaces:
- **`packages/db`**: Database migrations (`packages/db/migrations`), Supabase clients (`client.ts`), and TypeScript schema types (`types.ts`).
- **`packages/engine`**: Pure TypeScript tournament logic with zero UI or database imports. Includes standings calculation with head-to-head tiebreakers (`standings.ts`), round robin circle generation (`formats/round_robin.ts`), single elimination bracket seeding (`formats/single_elimination.ts`), auto-scheduling with court rest periods (`scheduling.ts`), and slot resolution (`slots.ts`). Has 63 passing unit tests (`npm run test`).
- **`apps/web`**: Next.js 16 (App Router) with React 19, Tailwind CSS v4.
  - Public routes: `/t/[slug]` (Live), `/t/[slug]/matches`, `/t/[slug]/standings`, `/t/[slug]/bracket`, `/t/[slug]/info`.
  - Organizer console: `/admin` (Passcode protected), `/admin/[slug]/setup/*` (info, players, teams, groups, stages, review), `/admin/[slug]/matches`, `/admin/[slug]/schedule`.

---

## 3. What Was Implemented in Commit `b3890b9` (Spec 1)

### Files Created:
1. `packages/db/migrations/0011_player_avatar.sql`:
   - Adds `avatar_url text` to the `player` table.
2. `apps/web/components/PlayerAvatar.tsx`:
   - `<PlayerAvatar>`: Displays player photo with smooth rounding. If no photo is present (or fails to load), automatically renders an initials badge (e.g., `"JV"`) on a brand navy/gold background.
   - `<TeamAvatarGroup>`: Displays an overlapping cluster of 2 avatars for doubles, or 1 avatar for singles.
3. `apps/web/app/admin/[slug]/setup/players/PlayerPhotoUpload.tsx`:
   - Client component for each player row in the roster.
   - Features "Add photo" / "Change photo" supporting file uploads and direct mobile camera capture.
   - Automatically resizes and compresses images on an HTML5 canvas (max 320x320 JPEG, ~15-25KB) for fast, lightweight uploads.
   - Includes a "Reset to icon" button to remove the photo and revert to the default initials/icon badge.

### Files Modified:
1. `packages/db/src/types.ts`:
   - Added `avatar_url: string | null` to `player` `Row`, `Insert`, and `Update` types.
2. `apps/web/lib/team-display.ts`:
   - Updated `TEAM_WITH_MEMBERS_SELECT` to fetch `avatar_url`.
   - Updated `teamDisplayFromJoined` and `TeamDisplay` type to include player metadata (`id`, `name`, `avatarUrl`).
3. `apps/web/components/MatchCard.tsx`:
   - Integrated `<TeamAvatarGroup>` in `MatchSide` so team/player avatars render on all match cards.
4. `apps/web/components/TeamMatchup.tsx`:
   - Integrated `<TeamAvatarGroup>` in `TeamLine` (used in schedule, live view, and standings).
5. `apps/web/app/admin/[slug]/setup/players/page.tsx`:
   - Added `PlayerPhotoUpload` component to each player row.
6. `apps/web/app/admin/[slug]/setup/teams/page.tsx`:
   - Added `PlayerAvatar` and `TeamAvatarGroup` to the team roster and creation cards.
7. `apps/web/app/admin/actions.ts`:
   - Added `updatePlayerAvatar` and `removePlayerAvatar` server actions with Supabase Storage bucket handling (`player-avatars`) and base64 fallback.
   - Updated `deepDuplicateTournament` to copy `avatar_url`.
   - Fixed 2 pre-existing ESLint `@typescript-eslint/no-explicit-any` errors in `qualification_rule` and `team_member` inserts.

---

## 4. Full Specifications (Specs 1 through 7)

### Specification 1: Player Photos & Profile Avatars (Partially Implemented)
- **Status:** Code implemented in `b3890b9`. Requires running `ALTER TABLE public.player ADD COLUMN IF NOT EXISTS avatar_url text;` in Supabase SQL editor.
- **Requirement:** Photos are completely optional. If a player has no photo, display a fallback avatar with player initials or default icon.
- **Integration:** Visible on public match cards, standings, live court ticker, bracket cards, and admin roster.

### Specification 2: Format & Division Controls (Singles, Doubles, Team Wars)
- **Goal:** Enable organizers to choose the format when creating or configuring a tournament.
- **Divisions:**
  - **Singles (1v1):** `team_size = 1`. In the UI, adding a player automatically creates their 1-player team so organizers don't have to manually create and name individual teams.
  - **Doubles (2v2):** `team_size = 2`. Standard doubles team pairing.
  - **Team Wars (PPL / MLP Style):** `team_size = 4+` (e.g. 2 men, 2 women, or open 4-player squads).
- **Team Wars Tie Match Engine:**
  - A Team Match / Tie consists of multiple rubbers/games:
    1. Women's Doubles
    2. Men's Doubles
    3. Mixed Doubles 1
    4. Mixed Doubles 2
    5. Dreambreaker (Singles tiebreaker if tied 2-2): 4 players rotate singles every 4 points, rally scoring to 21 with freeze at 20.
  - Match recording UI must allow recording individual rubber scores to determine the winning team.

### Specification 3: Dynamic Pools & Knockout Bracket Configuration
- **Goal:** Allow organizers to configure the exact structure of pool play and playoffs instead of relying on hardcoded templates.
- **Pool Builder UI (`/admin/[slug]/setup/groups`):**
  - Ability to choose the number of pools: 1, 2, 3, 4, 8 pools.
  - Add, remove, and rename pools.
  - "Snake Seeding" button to distribute ranked/seeded teams evenly across pools.
- **Advancement & Qualification Rules:**
  - Configurable advance count: Top 1, Top 2, Top 3, or Top 4 advance per pool.
  - Wildcard options based on overall point differential.
- **Knockout Bracket Sizing:**
  - Automatically generate the bracket based on total qualifiers:
    - 16 qualifiers -> Round of 16 (Top 16) -> Quarterfinals -> Semifinals -> Finals
    - 8 qualifiers -> Quarterfinals -> Semifinals -> Finals
    - 4 qualifiers -> Semifinals -> Finals
  - Standard crossover seeding (e.g. Pool A #1 plays Pool B #2).
  - Explicit toggle: **"Include Fight for 3rd (Bronze Medal Match)"**.
  - Explicit toggle: **"Fight for Championship (Gold Medal Match)"**.

### Specification 4: Full PPA Tournament Formats (Double Elimination & Consolation)
- **Goal:** Support official PPA tournament bracket structures.
- **Engine Extension (`packages/engine/src/formats/`):**
  - **`double_elimination.ts`**:
    - Winners Bracket (Championship): Best 2-of-3 to 11 win by 2.
    - Losers/Opportunity Bracket: 1 game to 15 win by 2.
    - Loser routing: Teams losing in winners bracket automatically drop into designated loser bracket nodes using `loser_to_node_id`.
    - Bronze Medal Match: Winner of Losers Bracket Semifinal vs Loser of Winners Bracket Final.
    - Grand Finals: Winner of Winners Bracket vs Winner of Losers Bracket, with optional "If-Necessary" sudden-death reset match if the Losers bracket winner takes match 1.
  - **Single Elimination with Bronze Backdraw**:
    - Semifinal losers automatically play a 3rd place match.

### Specification 5: Interactive Visual Bracket UI
- **Goal:** Replace the vertically stacked cards in `/t/[slug]/bracket` with a responsive bracket tree.
- **Features:**
  - Horizontal scrolling / pan-and-zoom bracket view.
  - Round columns with connector lines showing advancement pathways.
  - Tabs to switch between **Winners Bracket**, **Losers/Opportunity Bracket**, and **Finals / Podium**.
  - Visual status indicators for live, scheduled, and completed matches.

### Specification 6: True Offline PWA Support
- **Goal:** Ensure organizers and players can use the app on outdoor courts with poor connectivity.
- **Service Worker & Caching:**
  - Register a Service Worker using Serwist or Next-PWA with Workbox caching.
  - Precache core assets, app shell, fonts, and icons.
- **Offline Score Queue:**
  - In Admin score entry, save score submissions to IndexedDB if offline.
  - Automatically replay and sync queued scores when the connection is restored.
- **Manifest Enhancements:**
  - Add maskable icons, screenshots, and shortcuts in `manifest.ts`.
  - In-app "Install App" banner for iOS Safari and Android Chrome.

### Specification 7: Code Quality & Hygiene
- Keep `npm run test` passing (all 63 engine tests in `@pakangers/engine`).
- Keep `npm run typecheck` and `npm --prefix apps/web run lint` completely clean with 0 errors.
- Remove hardcoded demo slugs (`pakangers-2026-copy`) in `apps/web/app/admin/actions.ts` (`ensurePakangersCopyExists`).

---

## 5. Summary Checklist for Claude

1. Verify Supabase table column: `ALTER TABLE public.player ADD COLUMN IF NOT EXISTS avatar_url text;`.
2. Run `npm run test` and `npm run typecheck` to verify workspace health.
3. Review `apps/web/lib/team-display.ts` and `apps/web/components/PlayerAvatar.tsx` to see how avatars are connected.
4. Proceed with Spec 2 (Singles/Doubles/Team Wars) or Spec 3 (Dynamic Pools and Bracket sizing).
