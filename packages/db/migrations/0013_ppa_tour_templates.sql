-- Rename Pakangers 2 Pools template
update public.tournament_template
set name = 'Pakangers — 2 Pools to Semifinals',
    description = 'Two pools (default 4 + 5 teams), round robin to 11 sudden death. Top 2 from each pool cross over into semifinals to 15 sudden death, then third place and championship.'
where name in ('Pakangers — 2 Pools + Top 4', 'Pakangers - 2 Pools + Top 4');

-- 1. PPA Tour Style — 8 Pools to Quarter Finals
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 8 Pools to Quarter Finals',
  '32 teams across 8 pools (A through H), round robin to 15 sudden death. Top 1 from each pool advances to Quarterfinals opposite crossover (A1 vs H1, B1 vs G1, C1 vs F1, D1 vs E1), Semifinals, and Finals/3rd place (15 win by 2 deuce).',
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
        "key": "quarterfinals",
        "name": "Quarterfinals",
        "formatKey": "single_elimination",
        "sequence": 2,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "H", "rank": 1 } },
          { "match": 2, "home": { "kind": "group_rank", "group": "D", "rank": 1 }, "away": { "kind": "group_rank", "group": "E", "rank": 1 } },
          { "match": 3, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "G", "rank": 1 } },
          { "match": 4, "home": { "kind": "group_rank", "group": "C", "rank": 1 }, "away": { "kind": "group_rank", "group": "F", "rank": 1 } }
        ]
      },
      {
        "key": "semifinals",
        "name": "Semifinals",
        "formatKey": "single_elimination",
        "sequence": 3,
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
        "sequence": 4,
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
        "sequence": 5,
        "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "winner" } }
        ]
      }
    ],
    "qualification": [
      { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "C", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "D", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "E", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "F", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "G", "method": "top_n", "value": 1, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "H", "method": "top_n", "value": 1, "toStage": "quarterfinals" }
    ]
  }''::jsonb
where not exists (
  select 1 from public.tournament_template where name = ''PPA Tour Style — 8 Pools to Quarter Finals''
);

-- 2. PPA Tour Style — 4 Pools to Round of 16
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 4 Pools to Round of 16',
  '16-20 teams across 4 pools (A through D), round robin to 15 sudden death. Top 4 from each pool advance to Round of 16 crossover, Quarterfinals, Semifinals, and Finals/3rd place (15 win by 2 deuce).',
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
          { "name": "A", "size": 4 }, { "name": "B", "size": 4 }, { "name": "C", "size": 4 }, { "name": "D", "size": 4 }
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
          { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "D", "rank": 4 } },
          { "match": 2, "home": { "kind": "group_rank", "group": "B", "rank": 2 }, "away": { "kind": "group_rank", "group": "C", "rank": 3 } },
          { "match": 3, "home": { "kind": "group_rank", "group": "C", "rank": 1 }, "away": { "kind": "group_rank", "group": "B", "rank": 4 } },
          { "match": 4, "home": { "kind": "group_rank", "group": "D", "rank": 2 }, "away": { "kind": "group_rank", "group": "A", "rank": 3 } },
          { "match": 5, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "C", "rank": 4 } },
          { "match": 6, "home": { "kind": "group_rank", "group": "A", "rank": 2 }, "away": { "kind": "group_rank", "group": "D", "rank": 3 } },
          { "match": 7, "home": { "kind": "group_rank", "group": "D", "rank": 1 }, "away": { "kind": "group_rank", "group": "A", "rank": 4 } },
          { "match": 8, "home": { "kind": "group_rank", "group": "C", "rank": 2 }, "away": { "kind": "group_rank", "group": "B", "rank": 3 } }
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
      { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 4, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 4, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "C", "method": "top_n", "value": 4, "toStage": "round_of_16" },
      { "fromStage": "pools", "fromGroup": "D", "method": "top_n", "value": 4, "toStage": "round_of_16" }
    ]
  }''::jsonb
where not exists (
  select 1 from public.tournament_template where name = ''PPA Tour Style — 4 Pools to Round of 16''
);

-- 3. PPA Tour Style — 4 Pools to Quarter Finals
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 4 Pools to Quarter Finals',
  '16 teams across 4 pools (A through D), round robin to 15 sudden death. Top 2 from each pool advance to Quarterfinals opposite crossover (A1 vs D2, B1 vs C2, C1 vs B2, D1 vs A2), Semifinals, and Finals/3rd place (15 win by 2 deuce).',
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
          { "name": "A", "size": 4 }, { "name": "B", "size": 4 }, { "name": "C", "size": 4 }, { "name": "D", "size": 4 }
        ]
      },
      {
        "key": "quarterfinals",
        "name": "Quarterfinals",
        "formatKey": "single_elimination",
        "sequence": 2,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "D", "rank": 2 } },
          { "match": 2, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "C", "rank": 2 } },
          { "match": 3, "home": { "kind": "group_rank", "group": "C", "rank": 1 }, "away": { "kind": "group_rank", "group": "B", "rank": 2 } },
          { "match": 4, "home": { "kind": "group_rank", "group": "D", "rank": 1 }, "away": { "kind": "group_rank", "group": "A", "rank": 2 } }
        ]
      },
      {
        "key": "semifinals",
        "name": "Semifinals",
        "formatKey": "single_elimination",
        "sequence": 3,
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
        "sequence": 4,
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
        "sequence": 5,
        "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "winner" } }
        ]
      }
    ],
    "qualification": [
      { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 2, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 2, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "C", "method": "top_n", "value": 2, "toStage": "quarterfinals" },
      { "fromStage": "pools", "fromGroup": "D", "method": "top_n", "value": 2, "toStage": "quarterfinals" }
    ]
  }''::jsonb
where not exists (
  select 1 from public.tournament_template where name = ''PPA Tour Style — 4 Pools to Quarter Finals''
);
