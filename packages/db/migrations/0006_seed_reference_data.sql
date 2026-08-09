-- Reference data: the 2026 rule set, and the starter tournament templates
-- from docs/07-roadmap-and-risks.md (Phase 9). Config JSON is written in the
-- same shape packages/engine/src/types.ts already consumes (ScoringConfig,
-- SlotRef, etc.) so "create tournament from template" is a direct feed into
-- the engine later, not a translation layer.

insert into public.rule_set (name, governing_body, edition_year, effective_date, source_url) values
('USA Pickleball Official Rules — 2026', 'USA Pickleball', 2026, '2026-01-01', 'https://usapickleball.org/rules/');

insert into public.tournament_template (name, description, config) values
(
  'Pakangers — 2 Pools + Top 4',
  'Two pools (default 4 + 5 teams), round robin to 11 sudden death. Top 2 from each pool cross over into semifinals to 15 sudden death, then third place and championship.',
  '{
    "divisions": [
      { "key": "open_doubles", "name": "Open Doubles", "teamSize": 2 }
    ],
    "stages": [
      {
        "key": "pools", "name": "Pool Stage", "formatKey": "round_robin", "sequence": 1,
        "scoring": { "pointsToWin": 11, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": ["match_wins", "point_differential", "points_scored"],
        "groups": [ { "name": "A", "size": 4 }, { "name": "B", "size": 5 } ]
      },
      {
        "key": "semifinals", "name": "Semifinals", "formatKey": "single_elimination", "sequence": 2,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "B", "rank": 2 } },
          { "match": 2, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "A", "rank": 2 } }
        ]
      },
      {
        "key": "third_place", "name": "Third Place", "formatKey": "single_elimination", "sequence": 3,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "loser" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "loser" } }
        ]
      },
      {
        "key": "championship", "name": "Championship", "formatKey": "single_elimination", "sequence": 4,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "winner" } }
        ]
      }
    ],
    "qualification": [
      { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 2, "toStage": "semifinals" },
      { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 2, "toStage": "semifinals" }
    ]
  }'::jsonb
),
(
  'Single Elimination 16',
  'A straightforward 16-team knockout bracket, best of 1, standard seeding with byes if fewer than 16 register.',
  '{
    "divisions": [ { "key": "open", "name": "Open", "teamSize": 2 } ],
    "stages": [
      {
        "key": "knockout", "name": "Knockout", "formatKey": "single_elimination", "sequence": 1,
        "scoring": { "pointsToWin": 11, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": []
      }
    ],
    "qualification": []
  }'::jsonb
),
(
  'Doubles Round Robin 8',
  'One pool of 8 teams, round robin to 11, first place wins -- no knockout stage.',
  '{
    "divisions": [ { "key": "doubles", "name": "Doubles", "teamSize": 2 } ],
    "stages": [
      {
        "key": "pool", "name": "Round Robin", "formatKey": "round_robin", "sequence": 1,
        "scoring": { "pointsToWin": 11, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": ["match_wins", "point_differential", "points_scored"],
        "groups": [ { "name": "Pool", "size": 8 } ]
      }
    ],
    "qualification": []
  }'::jsonb
);
