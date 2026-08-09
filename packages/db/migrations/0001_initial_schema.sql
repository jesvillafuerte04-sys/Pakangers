-- Initial schema for the Pakangers tournament platform.
-- Mirrors docs/03-data-model.md. One deviation: `group` is renamed to
-- `tournament_group` throughout, since GROUP is a reserved word in Postgres.

create table public.rule_set (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  governing_body text not null,
  edition_year integer not null,
  effective_date date not null,
  source_url text not null,
  created_at timestamptz not null default now()
);

create table public.tournament (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  date_start date,
  date_end date,
  venue text,
  organizer_name text,
  description text,
  logo_url text,
  status text not null default 'draft'
    check (status in ('draft','registration','locked','in_progress','completed','archived')),
  rule_set_id uuid references public.rule_set(id),
  timezone text not null default 'Asia/Manila',
  created_from_template_id uuid, -- FK added in 0002, after tournament_template exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.division (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  name text not null,
  skill_level text,
  team_size integer not null default 2 check (team_size >= 1),
  gender_category text,
  created_at timestamptz not null default now()
);

create table public.player (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  contact text,
  dupr_id text,
  skill_rating numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  division_id uuid not null references public.division(id) on delete cascade,
  name text not null,
  team_number integer,
  seed integer,
  group_id uuid, -- FK added below, after tournament_group exists
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.team_member (
  team_id uuid not null references public.team(id) on delete cascade,
  player_id uuid not null references public.player(id) on delete cascade,
  position integer not null default 1,
  primary key (team_id, player_id)
);

create table public.stage (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  division_id uuid not null references public.division(id) on delete cascade,
  key text not null,
  name text not null,
  format_key text not null,
  sequence integer not null default 0,
  scoring_config jsonb not null default '{}'::jsonb,
  tiebreaker_config jsonb not null default '[]'::jsonb,
  entrant_config jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  created_at timestamptz not null default now(),
  unique (tournament_id, division_id, key)
);

create table public.tournament_group (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stage(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.team
  add constraint team_group_id_fkey foreign key (group_id) references public.tournament_group(id) on delete set null;

create table public.qualification_rule (
  id uuid primary key default gen_random_uuid(),
  from_stage_id uuid not null references public.stage(id) on delete cascade,
  from_group_id uuid references public.tournament_group(id) on delete cascade,
  method text not null check (method in ('top_n','top_percent','threshold','wildcard')),
  value numeric not null,
  to_stage_id uuid not null references public.stage(id) on delete cascade,
  seeding_policy text,
  created_at timestamptz not null default now()
);

create table public.bracket_node (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stage(id) on delete cascade,
  round integer not null,
  position integer not null,
  home_ref jsonb,
  away_ref jsonb,
  match_id uuid, -- FK added in 0002, after match exists
  winner_to_node_id uuid references public.bracket_node(id) on delete set null,
  loser_to_node_id uuid references public.bracket_node(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.court (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  name text not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.match (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  stage_id uuid not null references public.stage(id) on delete cascade,
  group_id uuid references public.tournament_group(id) on delete set null,
  bracket_node_id uuid references public.bracket_node(id) on delete set null,
  match_number integer not null,
  home_team_id uuid references public.team(id) on delete set null,
  away_team_id uuid references public.team(id) on delete set null,
  court_id uuid references public.court(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','scheduled','in_progress','completed','forfeit','bye')),
  scoring_config jsonb not null,
  source text not null default 'generated' check (source in ('generated','manual')),
  supersedes_match_id uuid references public.match(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (stage_id, match_number)
);

alter table public.bracket_node
  add constraint bracket_node_match_id_fkey foreign key (match_id) references public.match(id) on delete set null;

create table public.game (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  game_number integer not null,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  unique (match_id, game_number)
);

create table public.match_result (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.match(id) on delete cascade,
  winner_team_id uuid references public.team(id) on delete set null,
  home_games_won integer not null default 0,
  away_games_won integer not null default 0,
  home_points_total integer not null default 0,
  away_points_total integer not null default 0,
  result_type text not null default 'normal' check (result_type in ('normal','forfeit','default','retired')),
  recorded_by text not null,
  recorded_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  actor_name text not null,
  actor_ip text,
  created_at timestamptz not null default now()
);

create table public.external_result_submission (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  provider text not null default 'dupr',
  status text not null default 'pending'
    check (status in ('pending','exported','submitted','failed','not_eligible')),
  payload jsonb,
  submitted_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.tournament_rule (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid references public.rule_set(id) on delete cascade,
  tournament_id uuid references public.tournament(id) on delete cascade,
  category text not null,
  title text not null,
  summary_text text not null,
  source_ref text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (rule_set_id is not null or tournament_id is not null)
);

-- A player may only be on one team within a given division.
create or replace function public.enforce_single_team_per_division()
returns trigger as $$
declare
  v_division_id uuid;
  v_conflict_count integer;
begin
  select division_id into v_division_id from public.team where id = new.team_id;
  select count(*) into v_conflict_count
  from public.team_member tm
  join public.team t on t.id = tm.team_id
  where tm.player_id = new.player_id
    and t.division_id = v_division_id
    and tm.team_id <> new.team_id;
  if v_conflict_count > 0 then
    raise exception 'Player % is already assigned to another team in this division', new.player_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger team_member_single_division_check
before insert or update on public.team_member
for each row execute function public.enforce_single_team_per_division();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger tournament_set_updated_at
before update on public.tournament
for each row execute function public.set_updated_at();
