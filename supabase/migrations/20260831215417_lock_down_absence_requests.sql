drop policy if exists absences_select on public.absences;
drop policy if exists absences_insert on public.absences;
drop policy if exists absences_update on public.absences;
drop policy if exists absences_delete on public.absences;

create policy absences_select
on public.absences for select
to authenticated
using ((select private.is_admin()) or (select auth.uid()) = user_id);

create policy absences_insert
on public.absences for insert
to authenticated
with check (
  (select private.is_admin())
  or ((select auth.uid()) = user_id and status = 'pending')
);

create policy absences_update
on public.absences for update
to authenticated
using (
  (select private.is_admin())
  or ((select auth.uid()) = user_id and status = 'pending')
)
with check (
  (select private.is_admin())
  or ((select auth.uid()) = user_id and status = 'pending')
);

create policy absences_delete
on public.absences for delete
to authenticated
using (
  (select private.is_admin())
  or ((select auth.uid()) = user_id and status = 'pending')
);
