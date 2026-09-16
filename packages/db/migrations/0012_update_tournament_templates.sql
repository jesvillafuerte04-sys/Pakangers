-- Remove starter templates not used by existing tournaments
delete from public.tournament_template
where id not in (
  select distinct created_from_template_id
  from public.tournament
  where created_from_template_id is not null
)
and name in ('Single Elimination 16', 'Doubles Round Robin 8', 'Test 2 - Round Robin');

-- Add PPA Tour Style template: 8 Pools to Round of 16 (Top 2 advance) with Opposite Crossovers
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 8 Pools to Round of 16',
  '32 teams across 8 pools (A through H), round robin to 15 sudden death. Top 2 from each pool advance to Round of 16 opposite crossover (A1 vs H2, B1 vs G2...), Quarterfinals, Semifinals, and Finals/3rd place (15 win by 2 deuce).',
  '{
    "divisions": [
      { "key": "open_doubles", "name": "Open Doubles", "teamSize": 2 }
    ],
    "stages": [
      {
        "key": "pools",
        "name": "Pool Stage",
        "formatKey": "round_robin",
        "sequence": 1,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": ["match_wins", "point_differential", "points_scored"],
        "groups": [
          { "name": "A", "size": 4 }, { "name": "B", "size": 4 }, { "name": "C", "size": 4 }, { "name": "D", "size": 4 },
          { "name": "E", "size": 4 }, { "name": "F", "size": 4 }, { "name": "G", "size": 4 }, { "name": "H", "size": 4 }
        ]
      },
      {
        "key": "round_of_16",
        "name": "Round of 16",
        "formatKey": "single_elimination",
        "sequence": 2,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "H", "rank": 2 } },
          { "match": 2, "home": { "kind": "group_rank", "group": "D", "rank": 1 }, "away": { "kind: "group_rank", "group": "E", "rank": 2 } },
          { "match": 3, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "G", "rank": 2 } },
          { "match": 4, "home": { "kind": "group_rank", "group": "C", "rank": 1 }, "away": { "kind": "group_rank", "group": "F", "rank": 2 } },
          { "match": 5, "home": { "kind": "group_rank", "group": "E", "rank": 1 }, "away": { "kind": "group_rank", "group": "D", "rank": 2 } },
          { "match": 6, "home": { "kind": "group_rank", "group": "H", "rank": 1 }, "away": { "kind": "group_rank", "group": "A", "rank": 2 } },
          { "match": 7, "home": { "kind": "group_rank", "group": "F", "rank": 1 }, "away": { "kind": "group_rank", "group": "C", "rank": 2 } },
          { "match": 8, "home": { "kind": "group_rank", "group": "G", "rank": 1 }, "away": { "kind": "group_rank", "group": "B", "rank": 2 } }
        ]
      },
      {
        "key": "quarterfinals",
        "name": "Quarterfinals",
        "formatKey": "single_elimination",
        "sequence": 3,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "round_of_16", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "round_of_16", "match": 2, "outcome": "winner" } },
          { "match": 2, "home": { "kind": "match_outcome", "stage": "round_of_16", "match": 3, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "round_of_16", "match": 4, "outcome": "winner" } },
          { "match": 3, "home": { "kind": "match_outcome", "stage": "round_of_16", "match": 5, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "round_of_16", "match": 6, "outcome": "winner" } },
          { "match": 4, "home": { "kind": "match_outcome", "stage": "round_of_16", "match": 7, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "round_of_16", "match": 8, "outcome": "winner" } }
        ]
      },
      {
        "key": "semifinals",
        "name": "Semifinals",
        "formatKey": "single_elimination",
        "sequence": 4,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "quarterfinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "quarterfinals", "match": 2, "outcome": "winner" } },
          { "match": 2, "home": { "kind": "match_outcome", "stage": "quarterfinals", "match": 3, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "quarterfinals", "match": 4, "outcome": "winner" } }
        ]
      },
      {
        "key": "third_place",
        "name": "Third Place",
        "formatKey": "single_elimination",
        "sequence": 5,
        "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "loser" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "loser" } }
        ]
      },
      {
        "key": "championship",
        "name": "Championship",
        "formatKey": "single_elimination",
        "sequence": 6,
        "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "winner" } }
        ]
      }
    ],
    "qualification": [
      { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "C", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "D", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "E", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "F", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "G", "method": "top_n", "value": 2, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "H", "method": "top_n", "value": 2, "toStage": "round_of_16" }
    ]
  }''::jsonb
where not exists (
  select 1 from public.tournament_template where name = ''PPA Tour Style — 8 Pools to Round of 16''
);
