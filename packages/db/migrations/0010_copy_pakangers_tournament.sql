-- Creates a copy of the draft "1st Pakangers Exclusive Tournament"
-- for testing/inspection purposes.

with new_tournament as (
  insert into public.tournament (
    name, slug, date_start, date_end, venue, organizer_name, description,
    status, rule_set_id, timezone, created_from_template_id
  )
  select
    '1st Pakangers Exclusive Tournament (Copy)',
    'pakangers-2026-copy',
    t.date_start, t.date_end,
    t.venue, t.organizer_name,
    t.description,
    'draft',
    t.rule_set_id,
    t.timezone,
    t.created_from_template_id
  from public.tournament t
  where t.slug = 'pakangers-2026'
  returning id
),
new_division as (
  insert into public.division (tournament_id, name, team_size)
  select id, 'Open Doubles', 2 from new_tournament
  returning id, tournament_id
),
pools_stage as (
  insert into public.stage (tournament_id, division_id, key, name, format_key, sequence, scoring_config, tiebreaker_config)
  select nd.tournament_id, nd.id, 'pools', 'Pool Stage', 'round_robin', 1,
    '{"pointsToWin":11,"winBy":"sudden_death","bestOf":1,"scoringType":"side_out"}'::jsonb,
    '["match_wins","point_differential","points_scored"]'::jsonb
  from new_division nd
  returning id, tournament_id, division_id
),
semis_stage as (
  insert into public.stage (tournament_id, division_id, key, name, format_key, sequence, scoring_config, tiebreaker_config, entrant_config)
  select tournament_id, division_id, 'semifinals', 'Semifinals', 'single_elimination', 2,
    '{"pointsToWin":15,"winBy":"sudden_death","bestOf":1,"scoringType":"side_out"}'::jsonb,
    '[]'::jsonb,
    '{"entrants":[{"match":1,"home":{"kind":"group_rank","group":"A","rank":1},"away":{"kind":"group_rank","group":"B","rank":2}},{"match":2,"home":{"kind":"group_rank","group":"B","rank":1},"away":{"kind":"group_rank","group":"A","rank":2}}]}'::jsonb
  from pools_stage
  returning id, tournament_id, division_id
),
third_stage as (
  insert into public.stage (tournament_id, division_id, key, name, format_key, sequence, scoring_config, tiebreaker_config, entrant_config)
  select tournament_id, division_id, 'third_place', 'Third Place', 'single_elimination', 3,
    '{"pointsToWin":15,"winBy":"sudden_death","bestOf":1,"scoringType":"side_out"}'::jsonb,
    '[]'::jsonb,
    '{"entrants":[{"match":1,"home":{"kind":"match_outcome","stage":"semifinals","match":1,"outcome":"loser"},"away":{"kind":"match_outcome","stage":"semifinals","match":2,"outcome":"loser"}}]}'::jsonb
  from semis_stage
  returning id
),
champ_stage as (
  insert into public.stage (tournament_id, division_id, key, name, format_key, sequence, scoring_config, tiebreaker_config, entrant_config)
  select tournament_id, division_id, 'championship', 'Championship', 'single_elimination', 4,
    '{"pointsToWin":15,"winBy":"sudden_death","bestOf":1,"scoringType":"side_out"}'::jsonb,
    '[]'::jsonb,
    '{"entrants":[{"match":1,"home":{"kind":"match_outcome","stage":"semifinals","match":1,"outcome":"winner"},"away":{"kind":"match_outcome","stage":"semifinals","match":2,"outcome":"winner"}}]}'::jsonb
  from semis_stage
  returning id
),
groups as (
  insert into public.tournament_group (stage_id, name, display_order)
  select ps.id, g.name, g.ord
  from pools_stage ps, (values ('A', 0), ('B', 1)) as g(name, ord)
  returning id, stage_id, name
)
insert into public.qualification_rule (from_stage_id, from_group_id, method, value, to_stage_id)
select g.stage_id, g.id, 'top_n', 2, ss.id
from groups g, semis_stage ss;
