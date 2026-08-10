-- Public view (Phase 5) needs the browser to learn about a new score within
-- seconds without polling -- see docs/08-deployment.md ("Supabase Realtime,
-- not polling"). Realtime authorizes each change event against the
-- subscriber's RLS-effective permissions, so adding these tables to the
-- publication doesn't widen what anon can read (docs/03-data-model.md /
-- 0003_row_level_security.sql already do that) -- only what it can be
-- notified about.

alter publication supabase_realtime add table
  public.tournament,
  public.stage,
  public.match,
  public.game,
  public.match_result;
