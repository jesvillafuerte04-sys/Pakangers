-- Phase 6 scheduling. The court table and match.court_id already existed from
-- 0001 but were never used; what was missing is an ordering position and a
-- home for the scheduling settings.
--
-- Per docs/04-organizer-ui.md A8 this deliberately has no clock times: each
-- court owns an ordered queue and position N across courts is "round N", which
-- is how club events actually run. display_order is that position; null means
-- the match has not been placed yet.

alter table public.match add column display_order int;

-- Scheduling settings as JSON rather than columns, matching the schema rule in
-- docs/03-data-model.md ("nothing about a tournament's shape lives in a column
-- name"). Currently holds { minRestRounds }.
alter table public.tournament add column schedule_config jsonb not null default '{}'::jsonb;

create index idx_match_tournament_display_order on public.match (tournament_id, display_order);
