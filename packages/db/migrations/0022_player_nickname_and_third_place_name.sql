-- Player nicknames, used wherever a full roster is too long (tiebreak notes).
alter table public.player add column if not exists nickname text;

-- The third-place match is called "3rd Place" everywhere.
update public.stage
set name = '3rd Place'
where key = 'third_place' and name is distinct from '3rd Place';

update public.tournament_template t
set config = jsonb_set(
      t.config,
      '{stages}',
      (
        select jsonb_agg(
                 case when s->>'key' = 'third_place' then s || '{"name":"3rd Place"}'::jsonb else s end
                 order by ord
               )
        from jsonb_array_elements(t.config->'stages') with ordinality x(s, ord)
      )
    )
where exists (
  select 1 from jsonb_array_elements(t.config->'stages') s
  where s->>'key' = 'third_place' and s->>'name' is distinct from '3rd Place'
);
