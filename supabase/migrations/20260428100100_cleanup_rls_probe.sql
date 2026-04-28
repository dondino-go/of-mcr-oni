-- One-time cleanup of the RLS verification probe row inserted while applying the anon-insert policy.
delete from venues where google_place_id = '__rls_probe__';
