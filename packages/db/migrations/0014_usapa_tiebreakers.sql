-- USA Pickleball tie-break order for round-robin pools.
--
-- Previous order was ["match_wins", "point_differential", "points_scored"],
-- which never consulted the head-to-head result: a team could finish above an
-- opponent that had beaten it. USA Pickleball resolves ties by looking first at
-- what happened between the tied teams, and only then at results against the
-- rest of the pool.
--
-- New order:
--   1. match_wins                       -- most matches won
--   2. head_to_head                     -- wins in matches between the tied teams only
--   3. head_to_head_point_differential  -- point differential in those same matches
--   4. point_differential               -- overall point differential in the pool
--   5. points_allowed                   -- fewest points conceded
--   6. coin_flip                        -- organizer decides; engine flags it as unresolved
--
-- The engine also re-applies the list from the top whenever a tie splits, so a
-- three-way tie that collapses to two consults their head-to-head again.

-- 1. Update every stored template that still uses the old order.
update public.tournament_template
set config = replace(
      config::text,
      '"tiebreakers": ["match_wins", "point_differential", "points_scored"]',
      '"tiebreakers": ["match_wins", "head_to_head", "head_to_head_point_differential", "point_differential", "points_allowed", "coin_flip"]'
    )::jsonb
where config::text like '%"tiebreakers": ["match_wins", "point_differential", "points_scored"]%';

-- 2. Update live tournaments' stages that carry their own copy of the config.
--    Only stages whose tiebreaker list is exactly the old default are touched, so
--    any list a tournament director customised by hand is left alone.
update public.stage
set tiebreaker_config = '["match_wins","head_to_head","head_to_head_point_differential","point_differential","points_allowed","coin_flip"]'::jsonb
where tiebreaker_config = '["match_wins","point_differential","points_scored"]'::jsonb;
