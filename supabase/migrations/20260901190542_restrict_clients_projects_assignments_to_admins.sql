alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.assignments enable row level security;

drop policy if exists "Kunden können von Mitarbeitern verwaltet werden" on public.clients;
drop policy if exists clients_select on public.clients;
drop policy if exists clients_insert_admin on public.clients;
drop policy if exists clients_update_admin on public.clients;
drop policy if exists clients_delete_admin on public.clients;

create policy clients_select
on public.clients for select
to authenticated
using (true);

create policy clients_insert_admin
on public.clients for insert
to authenticated
with check ((select private.is_admin()));

create policy clients_update_admin
on public.clients for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy clients_delete_admin
on public.clients for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "Projekte können von Mitarbeitern verwaltet werden" on public.projects;
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_insert_admin on public.projects;
drop policy if exists projects_update_admin on public.projects;
drop policy if exists projects_delete_admin on public.projects;

create policy projects_select
on public.projects for select
to authenticated
using (true);

create policy projects_insert_admin
on public.projects for insert
to authenticated
with check ((select private.is_admin()));

create policy projects_update_admin
on public.projects for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy projects_delete_admin
on public.projects for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "Einsatzplan kann verwaltet werden" on public.assignments;
drop policy if exists assignments_select on public.assignments;
drop policy if exists assignments_insert_admin on public.assignments;
drop policy if exists assignments_update_admin on public.assignments;
drop policy if exists assignments_delete_admin on public.assignments;

create policy assignments_select
on public.assignments for select
to authenticated
using (true);

create policy assignments_insert_admin
on public.assignments for insert
to authenticated
with check ((select private.is_admin()));

create policy assignments_update_admin
on public.assignments for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy assignments_delete_admin
on public.assignments for delete
to authenticated
using ((select private.is_admin()));
