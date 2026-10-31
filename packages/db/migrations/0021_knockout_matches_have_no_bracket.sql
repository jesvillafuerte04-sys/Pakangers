-- Knockout matches were stamped with their home team's pool, so a semifinal
-- read as "Bracket B" and was numbered differently on the Matches and
-- Schedule pages than on the Bracket page. Only pool matches belong to a
-- bracket; clear it on every knockout match already created.
update public.match m
set group_id = null
from public.stage s
where s.id = m.stage_id
  and s.format_key = 'single_elimination'
  and m.group_id is not null;
