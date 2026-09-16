-- Rename Pakangers 2 Pools template to 2 Brackets
update public.tournament_template
set name = 'Pakangers — 2 Brackets to Semifinals',
    description = 'Two brackets (default 4 + 5 teams), round robin to 11 sudden death. Top 2 from each bracket cross over into semifinals to 15 sudden death, then third place and championship.'
where name in ('Pakangers — 2 Pools + Top 4', 'Pakangers - 2 Pools + Top 4', 'Pakangers — 2 Pools to Semifinals');

-- Rename 8 Pools to Round of 16 to 8 Brackets
update public.tournament_template
set name = 'PPA Tour Style — 8 Brackets to Round of 16',
    description = '32 teams across 8 brackets (A through H), round robin to 15 sudden death. Top 2 from each bracket advance to Round of 16 opposite crossover (A1 vs H2, B1 vs G2...), Quarterfinals, Semifinals, and Finals/3rd place (15 win by 2 deuce).'
where name = 'PPA Tour Style — 8 Pools to Round of 16';

-- 1. PPA Tour Style — 8 Brackets to Quarter Finals
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 8 Brackets to Quarter Finals',
  '32 teams across 8 brackets (A through H), round robin to 15 sudden death. Top 1 from each bracket advances to Quarterfinals opposite crossover (A1 vs H1, B1 vs G1, C1 vs F1, D1 vs E1), Semifinals, and Finals/3rd place (15 win by 2 deuce).',
  '{
    "divisions": [
      { "key": "open_doubles", "name": "Open Doubles", "teamSize": 2 }
    ],
    "stages": [
      {
        "key": "pools",
        "name": "Bracket",
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
  select 1 from public.tournament_template where name = ''PPA Tour Style — 8 Brackets to Quarter Finals''
);

-- 2. PPA Tour Style — 4 Brackets to Semi Finals
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 4 Brackets to Semi Finals',
  '16 teams across 4 brackets (A through D), round robin to 15 sudden death. Top 1 from each bracket advances to Semifinals (A1 vs D1, B1 vs C1), Finals and 3rd place (15 win by 2 deuce).',
  '{
    "divisions": [
      { "key": "open_doubles", "name": "Open Doubles", "teamSize": 2 }
    ],
    "stages": [
      {
        "key": "pools",
        "name": "Bracket",
        "formatKey": "round_robin",
        "sequence": 1,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": ["match_wins", "point_differential", "points_scored"],
        "groups": [
          { "name": "A", "size": 4 }, { "name": "B", "size": 4 }, { "name": "C", "size": 4 }, { "name": "D", "size": 4 }
        ]
      },
      {
        "key": "semifinals",
        "name": "Semifinals",
        "formatKey": "single_elimination",
        "sequence": 2,
        "scoring": { "pointsToWin": 15, "winBy": "sudden_death", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "group_rank", "group": "A", "rank": 1 }, "away": { "kind": "group_rank", "group": "D", "rank": 1 } },
          { "match": 2, "home": { "kind": "group_rank", "group": "B", "rank": 1 }, "away": { "kind": "group_rank", "group": "C", "rank": 1 } }
        ]
      },
      {
        "key": "third_place",
        "name": "Third Place",
        "formatKey": "single_elimination",
        "sequence": 3,
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
        "sequence": 4,
        "scoring": { "pointsToWin": 15, "winBy": "win_by_two", "bestOf": 1, "scoringType": "side_out" },
        "tiebreakers": [],
        "entrants": [
          { "match": 1, "home": { "kind": "match_outcome", "stage": "semifinals", "match": 1, "outcome": "winner" }, "away": { "kind": "match_outcome", "stage": "semifinals", "match": 2, "outcome": "winner" } }
        ]
      }
    ],
    "qualification": [
      { "fromStage": "pools", "fromGroup": "A", "method": "top_n", "value": 1, "toStage": "semifinals" },
      { "fromStage": "pools", "fromGroup": "B", "method": "top_n", "value": 1, "toStage": "semifinals" },
      { "fromStage": "pools", "fromGroup": "C", "method": "top_n", "value": 1, "toStage": "semifinals" },
      { "fromStage": "pools", "fromGroup": "D", "method": "top_n", "value": 1, "toStage": "semifinals" }
    ]
  }''::jsonb
where not exists (
  select 1 from public.tournament_template where name = ''PPA Tour Style — 4 Brackets to Semi Finals''
);

-- 3. PPA Tour Style — 4 Brackets to Quarter Finals
insert into public.tournament_template (name, description, config)
select
  'PPA Tour Style — 4 Brackets to Quarter Finals',
  '16 teams across 4 brackets (A through D), round robin to 15 sudden death. Top 2 from each bracket advance to Quarterfinals opposite crossover (A1 vs D2, B1 vs C2, C1 vs B2, D1 vs A2), Semifinals, and Finals/3rd place (15 win by 2 deuce).',
  '{
    "divisions": [
      { "key": "open_doubles", "name": "Open Doubles", "teamSize": 2 }
    ],
    "stages": [
      {
        "key": "pools",
        "name": "Bracket",
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
  select 1 from public.tournament_template where name = ''PPA Tour Style — 4 Brackets to Quarter Finals''
);
