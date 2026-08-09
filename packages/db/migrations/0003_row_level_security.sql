-- Row-level security. Per docs/08-deployment.md: the browser only ever holds
-- the anon/publishable key, and that key is read-only. All writes (score
-- entry, setup, everything in the organizer console) go through server route
-- handlers using the service role key, which bypasses RLS entirely -- so no
-- write policies exist here for anon/authenticated at all.
--
-- Public read is scoped to tournaments that are not in `draft`, matching the
-- public-page requirement (no login) while keeping in-progress setup private.
-- Player contact info / DUPR IDs are never exposed to anon directly -- see
-- the public_player view below, which is the only public-facing player read.

alter table public.rule_set enable row level security;
create policy "rule_set_public_read" on public.rule_set for select using (true);

alter table public.tournament enable row level security;
create policy "tournament_public_read" on public.tournament for select using (status <> 'draft');

alter table public.division enable row level security;
create policy "division_public_read" on public.division for select using (
  exists (select 1 from public.tournament t where t.id = division.tournament_id and t.status <> 'draft')
);

-- player: intentionally no public select policy. Contact info, DUPR IDs, and
-- notes stay server-only. See public_player view for the public-safe subset.
alter table public.player enable row level security;

create view public.public_player
with (security_invoker = false)
as
select p.id, p.tournament_id, p.first_name, p.last_name
from public.player p
join public.tournament t on t.id = p.tournament_id
where t.status <> 'draft';

grant select on public.public_player to anon, authenticated;

alter table public.team enable row level security;
create policy "team_public_read" on public.team for select using (
  exists (select 1 from public.tournament t where t.id = team.tournament_id and t.status <> 'draft')
);

alter table public.team_member enable row level security;
create policy "team_member_public_read" on public.team_member for select using (
  exists (
    select 1 from public.team tm
    join public.tournament t on t.id = tm.tournament_id
    where tm.id = team_member.team_id and t.status <> 'draft'
  )
);

alter table public.stage enable row level security;
create policy "stage_public_read" on public.stage for select using (
  exists (select 1 from public.tournament t where t.id = stage.tournament_id and t.status <> 'draft')
);

alter table public.tournament_group enable row level security;
create policy "tournament_group_public_read" on public.tournament_group for select using (
  exists (
    select 1 from public.stage s
    join public.tournament t on t.id = s.tournament_id
    where s.id = tournament_group.stage_id and t.status <> 'draft'
  )
);

alter table public.qualification_rule enable row level security;
create policy "qualification_rule_public_read" on public.qualification_rule for select using (
  exists (
    select 1 from public.stage s
    join public.tournament t on t.id = s.tournament_id
    where s.id = qualification_rule.from_stage_id and t.status <> 'draft'
  )
);

alter table public.bracket_node enable row level security;
create policy "bracket_node_public_read" on public.bracket_node for select using (
  exists (
    select 1 from public.stage s
    join public.tournament t on t.id = s.tournament_id
    where s.id = bracket_node.stage_id and t.status <> 'draft'
  )
);

alter table public.court enable row level security;
create policy "court_public_read" on public.court for select using (
  exists (select 1 from public.tournament t where t.id = court.tournament_id and t.status <> 'draft')
);

alter table public.match enable row level security;
create policy "match_public_read" on public.match for select using (
  exists (select 1 from public.tournament t where t.id = match.tournament_id and t.status <> 'draft')
);

alter table public.game enable row level security;
create policy "game_public_read" on public.game for select using (
  exists (
    select 1 from public.match m
    join public.tournament t on t.id = m.tournament_id
    where m.id = game.match_id and t.status <> 'draft'
  )
);

alter table public.match_result enable row level security;
create policy "match_result_public_read" on public.match_result for select using (
  exists (
    select 1 from public.match m
    join public.tournament t on t.id = m.tournament_id
    where m.id = match_result.match_id and t.status <> 'draft'
  )
);

alter table public.tournament_rule enable row level security;
create policy "tournament_rule_public_read" on public.tournament_rule for select using (
  tournament_id is null
  or exists (select 1 from public.tournament t where t.id = tournament_rule.tournament_id and t.status <> 'draft')
);

-- Never public: internal audit trail, DUPR submission payloads/errors, and
-- the organizer's own template library.
alter table public.audit_log enable row level security;
alter table public.external_result_submission enable row level security;
alter table public.tournament_template enable row level security;
