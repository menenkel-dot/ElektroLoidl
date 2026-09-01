-- Reports must never expose another employee's time entries to a non-admin.
drop policy if exists time_entries_select on public.time_entries;

create policy time_entries_select
on public.time_entries
for select
to authenticated
using (
  (select private.is_admin())
  or (select auth.uid()) = user_id
);

-- Support the date-range filters used by employee and administrator reports.
create index if not exists time_entries_user_date_idx
on public.time_entries (user_id, date desc);

create index if not exists time_entries_date_idx
on public.time_entries (date desc);
