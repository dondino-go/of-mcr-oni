-- Adds Google rating fields to venues for use in smart sorting v2.
-- Run in Supabase dashboard SQL editor (project doesn't use migration CLI yet).

alter table venues
  add column if not exists google_rating numeric(2, 1),
  add column if not exists google_rating_count integer;
