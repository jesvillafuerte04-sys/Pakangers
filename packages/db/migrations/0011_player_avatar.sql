-- Add avatar_url column to player table for profile photos
alter table public.player
  add column if not exists avatar_url text;
