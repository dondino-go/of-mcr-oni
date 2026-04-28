-- Allow anon role to DELETE a venue only when it has no contributed data
-- (no cocktail rows AND no tag rows). Used by the contribute flow's
-- "remove this bar" path when AI extraction found nothing on the menu.
-- Hardened: a curious anon user can never delete bars others have contributed to.

create policy "anon can delete orphan venues"
  on venues for delete
  to anon
  using (
    not exists (select 1 from venue_cocktails where venue_id = venues.id)
    and not exists (select 1 from venue_tags where venue_id = venues.id)
  );
