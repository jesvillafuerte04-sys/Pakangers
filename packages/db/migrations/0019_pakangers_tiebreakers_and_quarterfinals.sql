-- Pakangers tie-break order, and quarterfinals for every official tournament.
--
-- 1. Round-robin ties are broken the way the club announces them:
--      1. match_wins            most matches won
--      2. head_to_head_two_way  two teams level: the winner of their match
--      3. point_differential    three or more level: overall margin
--      4. points_scored         then total points earned
--      5. coin_flip             then a coin toss; flagged, never guessed
--    The engine re-applies the list whenever a tie splits, so a three-way tie
--    narrowed to two by point differential is then settled head-to-head.
--
-- 2. The Pakangers starter template now runs to the quarterfinals: two
--    brackets, top 4 of each advance, crossover A1-B4, A2-B3, A3-B2, A4-B1
--    with A1 and B1 in opposite halves.

create temporary table pakangers_order on commit drop as
select '["match_wins","head_to_head_two_way","point_differential","points_scored","coin_flip"]'::jsonb as tb;

-- Every round-robin stage inside every stored template.
update public.tournament_template t
set config = jsonb_set(
      t.config,
      '{stages}',
      (
        select jsonb_agg(
                 case
                   when coalesce(s->>'format_key', s->>'formatKey') = 'round_robin'
                     then s || jsonb_build_object('tiebreakers', (select tb from pakangers_order))
                   else s
                 end
                 order by ord
               )
        from jsonb_array_elements(t.config->'stages') with ordinality x(s, ord)
      )
    )
where t.config ? 'stages';

-- Live tournaments that have not finished. Completed events keep the order
-- they were decided under.
update public.stage s
set tiebreaker_config = (select tb from pakangers_order)
from public.tournament t
where t.id = s.tournament_id
  and s.format_key = 'round_robin'
  and t.status <> 'completed'
  and s.tiebreaker_config is distinct from (select tb from pakangers_order);

-- The Pakangers template, rebuilt to the quarterfinals.
update public.tournament_template
set name = 'Pakangers — 2 Brackets to Quarter Finals',
    description = 'Two brackets of up to 8 teams, round robin to 11 sudden death. Top 4 from each bracket cross over into the quarterfinals (A1 vs B4, A2 vs B3, A3 vs B2, A4 vs B1) to 11 sudden death, semifinals to 15 sudden death, then third place and championship to 15 win by 2.',
    config = '{
      "divisions": [
        { "key": "open_doubles", "name": "Open Doubles", "teamSize": 2 }
      ],
      "stages": [
        {
          "key": "pools", "name": "Bracket", "formatKey": "round_robin", "sequence": 1,
          "scoring": { "pointsToWin": 11, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
          "tiebreakers": ["match_wins","head_to_head_two_way","point_differential","points_scored","coin_flip"],
          "groups": [ { "name": "A", "size": 8 }, { "name": "B", "size": 8 } ]
        },
        {
          "key": "quarterfinals", "name": "Quarterfinals", "formatKey": "single_elimination", "sequence": 2,
          "scoring": { "pointsToWin": 11, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
          "tiebreakers": [],
          "entrants": [
            { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "B", "rank": 4 } },
            { "match": 2, "home": { "kind": "group_rank", "group": "A", "rank": 3 }, "away": { "kind": "group_rank", "group": "B", "rank": 2 } },
            { "match": 3, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "A", "rank": 4 } },
            { "match": 4, "home": { "kind": "group_rank", "group": "B", "rank": 3 }, "away": { "kind": "group_rank", "group": "A", "rank": 2 } }
          ]
        },
        {
          "key": "semifinals", "name": "Semifinals", "formatKey": "single_elimination", "sequence": 3,
          "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
          "tiebreakers": [],
          "entrants": [
            { "match": 1, "home": { "kind": "match_outcome", "stage": "quarterfinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "quarterfinals", "match": 2, "outcome": "winner" } },
            { "match": 2, "home": { "kind": "match_outcome", "stage": "quarterfinals", "match": 3, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "quarterfinals", "match": 4, "outcome": "winner" } }
          ]
        },
        {
          "key": "third_place", "name": "Fight for Third", "formatKey": "single_elimination", "sequence": 4,
          "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
          "tiebreakers": [],
          "entrants": [
            { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "loser" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "loser" } }
          ]
        },
        {
          "key": "championship", "name": "Championship", "formatKey": "single_elimination", "sequence": 5,
          "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "cap": 21, "bestOf": 1, "scoringType": "side_out" },
          "tiebreakers": [],
          "entrants": [
            { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "winner" } }
          ]
        }
      ],
      "qualification": [
        { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 4, "toStage": "quarterfinals" },
        { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 4, "toStage": "quarterfinals" }
      ]
    }'::jsonb
where name = 'Pakangers — 2 Brackets to Semifinals';
