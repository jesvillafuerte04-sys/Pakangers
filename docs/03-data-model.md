# Data Model

Postgres via Supabase. All IDs `uuid`. All timestamps `timestamptz`.

**Design rule:** nothing about a specific tournament's shape lives in a column name or an enum. Group
names are free text. Stage sequences are rows. Scoring is JSON. Counts are values.

---

## Core

### `rule_set`
Which published rulebook a tournament runs under. Immutable once referenced by a tournament.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | "USA Pickleball Official Rules — 2026" |
| `governing_body` | text | "USA Pickleball" |
| `edition_year` | int | 2026 |
| `effective_date` | date | 2026-01-01 |
| `source_url` | text | Link to the official rulebook |

> Rule sets are never edited after a tournament references them. A 2027 tournament gets a **new row**.
> Historical tournaments keep the rules they were played under, forever.

### `tournament_rule`
Organizer-authored summaries. **Never the rulebook text itself** — see the copyright note in `01-research.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `rule_set_id` | uuid | nullable — tournament-specific rules have none |
| `tournament_id` | uuid | nullable — official-rule summaries have none |
| `category` | text | serving, scoring, faults, conduct, timeouts… |
| `title` | text | |
| `summary_text` | text | Short, organizer-written |
| `source_ref` | text | "Rule 4.A.5" + link |
| `display_order` | int | |

### `tournament`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | |
| `slug` | text unique | Used in the public URL |
| `date_start`, `date_end` | date | |
| `venue` | text | |
| `organizer_name` | text | |
| `description` | text | |
| `logo_url` | text | |
| `status` | enum | `draft · registration · locked · in_progress · completed · archived` |
| `rule_set_id` | uuid | |
| `timezone` | text | |
| `created_from_template_id` | uuid | nullable — which `tournament_template` this was created from, if any |

**No per-tournament passcode column.** The organizer passcode is a single deployment-level secret
(`ORGANIZER_PASSCODE_HASH`, see `08-deployment.md`), not stored per tournament. One passcode gates
the whole `/admin` area across every tournament this club ever runs — that's what makes creating a
second, third, and tenth tournament frictionless instead of another setup step each time.

### `division`
A tournament can have several. The first one has exactly one.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `tournament_id` | uuid | |
| `name` | text | "Open Doubles" |
| `skill_level` | text | nullable |
| `team_size` | int | **1 = singles, 2 = doubles, n = future** |
| `gender_category` | text | nullable — men's / women's / mixed / open |

> `team_size` is the field that makes singles support free. Nothing else in the schema assumes two.

---

## Participants

### `player`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `tournament_id` | uuid | |
| `first_name`, `last_name` | text | |
| `contact` | text | nullable |
| `dupr_id` | text | **nullable** — most club players won't have one |
| `skill_rating` | numeric | nullable |
| `notes` | text | nullable |

### `team`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `tournament_id`, `division_id` | uuid | |
| `name` | text | |
| `team_number` | int | |
| `seed` | int | nullable |
| `group_id` | uuid | nullable until assigned |
| `locked_at` | timestamptz | nullable |

### `team_member`

| Column | Type | Notes |
|---|---|---|
| `team_id`, `player_id` | uuid | |
| `position` | int | 1, 2, … |

**Constraint:** a trigger enforces that a player appears on at most one team per division.

---

## Structure

### `stage`
The heart of the configurability.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `tournament_id`, `division_id` | uuid | |
| `key` | text | "pools", "semifinals", "third_place", "championship" |
| `name` | text | Display name |
| `format_key` | text | `round_robin`, `single_elimination`, … |
| `sequence` | int | Order in the tournament |
| `scoring_config` | jsonb | See engine doc §3 |
| `tiebreaker_config` | jsonb | Ordered array — see engine doc §4 |
| `entrant_config` | jsonb | Slot references — see engine doc §5 |
| `status` | enum | `pending · in_progress · completed` |

### `group`
An entity, not a hardcoded letter.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `stage_id` | uuid | |
| `name` | text | "A", "Pool 1", "Beginner", "Men's" — free text |
| `display_order` | int | |

### `qualification_rule`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `from_stage_id` | uuid | |
| `from_group_id` | uuid | nullable — null means the whole stage |
| `method` | enum | `top_n · top_percent · threshold · wildcard` |
| `value` | numeric | |
| `to_stage_id` | uuid | |
| `seeding_policy` | text | How qualifiers are ordered on arrival |

### `bracket_node`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `stage_id` | uuid | |
| `round`, `position` | int | |
| `home_ref`, `away_ref` | jsonb | Slot references |
| `match_id` | uuid | nullable until the match exists |
| `winner_to_node_id` | uuid | nullable |
| `loser_to_node_id` | uuid | nullable — **exists so double elimination is a data change, not a schema change** |

---

## Play

### `court`
`id`, `tournament_id`, `name`, `is_available`

### `match`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `tournament_id`, `stage_id` | uuid | |
| `group_id`, `bracket_node_id` | uuid | nullable |
| `match_number` | int | The number players see: "Match #12" |
| `home_team_id`, `away_team_id` | uuid | nullable until slots resolve |
| `court_id` | uuid | nullable |
| `scheduled_at` | timestamptz | nullable |
| `status` | enum | `pending · scheduled · in_progress · completed · forfeit · bye` |
| `scoring_config` | jsonb | **Snapshot at creation** — see engine doc §3 |
| `source` | enum | `generated · manual` — see engine doc §6. Standings/qualification recomputation only ever touches `generated` rows. |
| `supersedes_match_id` | uuid | nullable — set when a manual match replaces a forfeited one, so the original is excluded from standings without being deleted |

### `game`
One row per game. Best-of-3 and best-of-5 need no schema change.

`id`, `match_id`, `game_number`, `home_score`, `away_score`

### `match_result`

| Column | Type | Notes |
|---|---|---|
| `match_id` | uuid | |
| `winner_team_id` | uuid | |
| `home_games_won`, `away_games_won` | int | |
| `home_points_total`, `away_points_total` | int | Feeds point differential |
| `result_type` | enum | `normal · forfeit · default · retired` |
| `recorded_by` | text | The name the organizer typed |
| `recorded_at` | timestamptz | |

### `audit_log`
Written on **every** score create, edit, and delete.

`id`, `tournament_id`, `entity_type`, `entity_id`, `action`, `before` jsonb, `after` jsonb,
`actor_name`, `actor_ip`, `created_at`

### `external_result_submission`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `match_id` | uuid | |
| `provider` | text | `dupr` |
| `status` | enum | `pending · exported · submitted · failed · not_eligible` |
| `payload` | jsonb | |
| `submitted_at` | timestamptz | |
| `error` | text | e.g. "Player Maria Cruz has no DUPR ID" |

---

## Templates

### `tournament_template`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | Organizer-chosen, e.g. "Pakangers — 2 Pools + Top 4, 2026 edition" |
| `description` | text | nullable |
| `config` | jsonb | Full division / stage / scoring / tiebreaker / qualification skeleton |
| `source_tournament_id` | uuid | nullable — which tournament this was saved from, if any |
| `created_at` | timestamptz | |

Seeded at launch:
- **Pakangers — 2 Pools + Top 4** (RR to 11, knockout to 15, crossover semis, third place, final)
- **Single Elimination 16** (best of 1)
- **Doubles Round Robin 8** (one group, first to 11)

**Creating a tournament from a template** copies `config` into a new `tournament` plus its child
`division` / `stage` / `qualification_rule` rows — a one-time copy, not a live link. Editing
tournament #5 never touches the template or any other tournament created from it.

**Saving a tournament as a template** (A7 in the organizer UI) does the reverse: reads the current
tournament's configuration and writes a new `tournament_template` row. This is how the platform's own
history becomes its template library — next year's tournament can start from what actually ran this
year, not only from the three generic starters.

---

## What is deliberately NOT stored

**Standings.** They are computed by the engine from matches plus the configured tiebreakers, on every
read. Caching them as a materialized view is a performance decision to make later, if ever — never a
correctness one. A stored standings table is a second source of truth, and it will drift.

---

## Access control

- **Public read** via row-level security on non-sensitive columns, for tournaments where
  `status != 'draft'`.
- **All writes** go through server route handlers that verify the organizer passcode.
- The browser **never holds a write-capable key.**
