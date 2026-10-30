-- Why a match was awarded rather than played out.
--
-- The score form already asks for a reason on a forfeit, default or
-- retirement, but there was nowhere to put it, so it was discarded on save.
-- The public match card shows it next to the result type.
alter table public.match_result
  add column if not exists result_note text;
