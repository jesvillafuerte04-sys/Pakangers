-- USA Pickleball tie-break order for every round-robin stage, stored and future.
--
-- Audit finding (30 Oct 2026): 0014 was written but never applied, and every
-- template in the database still ranked brackets by
--   ["match_wins", "point_differential", "points_scored"]
-- which never consults the head-to-head result. A team could finish above an
-- opponent that had beaten it, and ranking on points scored rewards running up
-- the score, which USA Pickleball does not do.
--
-- The order applied here:
--   1. match_wins                       most matches won
--   2. head_to_head                     wins counted only between the tied teams
--   3. head_to_head_point_differential  the margin in those same matches
--   4. point_differential               overall margin across the bracket
--   5. points_allowed                   fewest points conceded
--   6. coin_flip                        organizer decides; flagged, never guessed
--
-- The engine also re-applies the list from the top whenever a tie splits, so a
-- three-way tie that collapses to two consults their head-to-head again.

create temporary table usapa_order on commit drop as
select '["match_wins","head_to_head","head_to_head_point_differential","point_differential","points_allowed","coin_flip"]'::jsonb as tb;

-- 1. Every round-robin stage inside every stored template.
update public.tournament_template t
set config = jsonb_set(
      t.config,
      '{stages}',
      (
        select jsonb_agg(
                 case
                   when coalesce(s->>'format_key', s->>'formatKey') = 'round_robin'
                     then s || jsonb_build_object('tiebreakers', (select tb from usapa_order))
                   else s
                 end
                 order by ord
               )
        from jsonb_array_elements(t.config->'stages') with ordinality x(s, ord)
      )
    )
where t.config ? 'stages'
  and exists (
    select 1
    from jsonb_array_elements(t.config->'stages') s
    where coalesce(s->>'format_key', s->>'formatKey') = 'round_robin'
      and coalesce(s->'tiebreakers', '[]'::jsonb) is distinct from (select tb from usapa_order)
  );

-- 2. Live tournaments that have not finished. Completed events keep the order
--    they were actually decided under, because rewriting it would change the
--    standings of a tournament whose medals are already handed out.
update public.stage s
set tiebreaker_config = (select tb from usapa_order)
from public.tournament t
where t.id = s.tournament_id
  and s.format_key = 'round_robin'
  and t.status <> 'completed'
  and s.tiebreaker_config is distinct from (select tb from usapa_order);
