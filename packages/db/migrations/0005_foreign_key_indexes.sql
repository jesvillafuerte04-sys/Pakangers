-- Indexes for every foreign key the Supabase performance advisor flagged as
-- uncovered, plus stage.tournament_id (not flagged, but a hot join column in
-- the RLS policies on tournament_group / qualification_rule / bracket_node).

create index if not exists idx_audit_log_tournament_id on public.audit_log (tournament_id);
create index if not exists idx_bracket_node_loser_to_node_id on public.bracket_node (loser_to_node_id);
create index if not exists idx_bracket_node_match_id on public.bracket_node (match_id);
create index if not exists idx_bracket_node_stage_id on public.bracket_node (stage_id);
create index if not exists idx_bracket_node_winner_to_node_id on public.bracket_node (winner_to_node_id);
create index if not exists idx_court_tournament_id on public.court (tournament_id);
create index if not exists idx_division_tournament_id on public.division (tournament_id);
create index if not exists idx_external_result_submission_match_id on public.external_result_submission (match_id);
create index if not exists idx_match_away_team_id on public.match (away_team_id);
create index if not exists idx_match_bracket_node_id on public.match (bracket_node_id);
create index if not exists idx_match_court_id on public.match (court_id);
create index if not exists idx_match_group_id on public.match (group_id);
create index if not exists idx_match_home_team_id on public.match (home_team_id);
create index if not exists idx_match_supersedes_match_id on public.match (supersedes_match_id);
create index if not exists idx_match_tournament_id on public.match (tournament_id);
create index if not exists idx_match_result_winner_team_id on public.match_result (winner_team_id);
create index if not exists idx_player_tournament_id on public.player (tournament_id);
create index if not exists idx_qualification_rule_from_group_id on public.qualification_rule (from_group_id);
create index if not exists idx_qualification_rule_from_stage_id on public.qualification_rule (from_stage_id);
create index if not exists idx_qualification_rule_to_stage_id on public.qualification_rule (to_stage_id);
create index if not exists idx_stage_division_id on public.stage (division_id);
create index if not exists idx_stage_tournament_id on public.stage (tournament_id);
create index if not exists idx_team_division_id on public.team (division_id);
create index if not exists idx_team_group_id on public.team (group_id);
create index if not exists idx_team_tournament_id on public.team (tournament_id);
create index if not exists idx_team_member_player_id on public.team_member (player_id);
create index if not exists idx_tournament_created_from_template_id on public.tournament (created_from_template_id);
create index if not exists idx_tournament_rule_set_id on public.tournament (rule_set_id);
create index if not exists idx_tournament_group_stage_id on public.tournament_group (stage_id);
create index if not exists idx_tournament_rule_rule_set_id on public.tournament_rule (rule_set_id);
create index if not exists idx_tournament_rule_tournament_id on public.tournament_rule (tournament_id);
create index if not exists idx_tournament_template_source_tournament_id on public.tournament_template (source_tournament_id);
