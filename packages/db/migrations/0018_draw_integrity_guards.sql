-- Guards for the two lookups that silently corrupted the draw.
--
-- match(stage_id, match_number) was already unique, which is why the knockout
-- corruption showed up as wrong teams rather than duplicate matches. These
-- two had no such protection:
--
--   tournament_group(stage_id, display_order) -- two brackets at one position
--     make bracket order, court assignment, match numbering and every
--     "Bracket B" reference ambiguous.
--
--   bracket_node(stage_id, round, position) -- the draw is keyed on this, so
--     a duplicate means two different refs for the same slot.

create unique index if not exists tournament_group_stage_position_key
  on public.tournament_group (stage_id, display_order);

create unique index if not exists bracket_node_stage_round_position_key
  on public.bracket_node (stage_id, round, position);
