-- Allow anon role to insert and update rows in `venues`.
-- Required for the in-app "Add a bar" flow (anon key writes from device).
-- DELETE deliberately omitted — preserves "anon can't truncate" stance from the hive-mind framing.

create policy "anon can insert venues"
  on venues for insert
  to anon
  with check (true);

create policy "anon can update venues"
  on venues for update
  to anon
  using (true)
  with check (true);
