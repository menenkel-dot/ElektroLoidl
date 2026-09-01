drop policy if exists "Projekte können von Mitarbeitern verwaltet werden" on public.projects;

create policy projects_select
on public.projects
for select
to authenticated
using (true);

create policy projects_insert
on public.projects
for insert
to authenticated
with check (true);

create policy projects_update_admin
on public.projects
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy projects_delete_admin
on public.projects
for delete
to authenticated
using ((select private.is_admin()));
