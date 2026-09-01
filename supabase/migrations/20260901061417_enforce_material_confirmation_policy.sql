drop policy if exists time_entries_insert on public.time_entries;

create policy time_entries_insert
on public.time_entries
for insert
to authenticated
with check (
  ((select private.is_admin()) or (select auth.uid()) = user_id)
  and material_recorded_confirmed is true
);
