-- Replace the public_player view (flagged SECURITY DEFINER by the linter --
-- it always bypasses RLS) with the Postgres-native alternative: a real RLS
-- policy on player scoped by tournament status, plus column-level grants
-- restricting anon/authenticated to only the public-safe fields. Contact
-- info, DUPR IDs, skill ratings, and notes stay invisible to anon even
-- though the row itself is now readable.

revoke select on public.public_player from anon, authenticated;
drop view public.public_player;

create policy "player_public_read" on public.player for select using (
  exists (select 1 from public.tournament t where t.id = player.tournament_id and t.status <> 'draft')
);

grant select (id, tournament_id, first_name, last_name) on public.player to anon, authenticated;

-- These are trigger-only functions, never meant to be called directly. Supabase
-- auto-exposes every public-schema function as an RPC endpoint by default --
-- close that off. Trigger firing doesn't require the invoking role to hold
-- EXECUTE, so this doesn't affect the triggers themselves.
revoke execute on function public.enforce_single_team_per_division() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
