-- Tournament templates: the mechanism that makes reusing this platform for a
-- future tournament a few clicks instead of a rebuild. See docs/03-data-model.md
-- and docs/04-organizer-ui.md (A1 -- Tournament list).

create table public.tournament_template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  config jsonb not null,
  source_tournament_id uuid references public.tournament(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tournament
  add constraint tournament_created_from_template_id_fkey
  foreign key (created_from_template_id) references public.tournament_template(id) on delete set null;
