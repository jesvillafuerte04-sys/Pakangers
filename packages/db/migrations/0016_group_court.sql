-- A bracket can be pinned to a court.
--
-- One bracket = one court is how Pakangers runs the elimination stage, and the
-- organizer wants to choose which bracket sits on which court rather than
-- accept whatever the auto-assigner picks. A pinned court is honoured by the
-- scheduler; a bracket left unpinned is still placed automatically.
--
-- on delete set null: deleting a court frees its brackets instead of blocking.
alter table public.tournament_group
  add column if not exists court_id uuid references public.court(id) on delete set null;

create index if not exists tournament_group_court_id_idx
  on public.tournament_group (court_id);
