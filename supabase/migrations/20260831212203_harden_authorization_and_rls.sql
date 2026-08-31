create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

alter function public.calculate_project_spent_value(uuid) set search_path = '';
alter function public.on_time_entry_change() set search_path = '';
alter function public.update_vacation_used() set search_path = '';

revoke execute on function public.calculate_project_spent_value(uuid) from public, anon, authenticated;
revoke execute on function public.on_time_entry_change() from public, anon, authenticated;
revoke execute on function public.update_vacation_used() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not (select private.is_admin())
     and (
       new.role is distinct from old.role
       or new.permissions is distinct from old.permissions
       or new.target_hours_monthly is distinct from old.target_hours_monthly
       or new.vacation_total is distinct from old.vacation_total
       or new.vacation_used is distinct from old.vacation_used
     )
  then
    raise exception 'Only administrators may change privileged profile fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_profile_privileged_fields() from public, anon, authenticated;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
before update on public.profiles
for each row
execute function public.protect_profile_privileged_fields();

drop policy if exists "Profiles sind für eingeloggte Nutzer sichtbar" on public.profiles;
drop policy if exists "Admins können alle Profile aktualisieren" on public.profiles;
drop policy if exists "Nutzer können ihr eigenes Profil aktualisieren" on public.profiles;

create policy profiles_select
on public.profiles for select
to authenticated
using (true);

create policy profiles_update
on public.profiles for update
to authenticated
using ((select private.is_admin()) or (select auth.uid()) = id)
with check ((select private.is_admin()) or (select auth.uid()) = id);

drop policy if exists "Abwesenheiten sind sichtbar" on public.absences;
drop policy if exists "Admins verwalten alle Abwesenheiten" on public.absences;
drop policy if exists "Nutzer verwalten eigene Anträge" on public.absences;

create policy absences_select
on public.absences for select
to authenticated
using (true);

create policy absences_insert
on public.absences for insert
to authenticated
with check ((select private.is_admin()) or (select auth.uid()) = user_id);

create policy absences_update
on public.absences for update
to authenticated
using ((select private.is_admin()) or (select auth.uid()) = user_id)
with check ((select private.is_admin()) or (select auth.uid()) = user_id);

create policy absences_delete
on public.absences for delete
to authenticated
using ((select private.is_admin()) or (select auth.uid()) = user_id);

drop policy if exists "Admins verwalten alle Zeiteinträge" on public.time_entries;
drop policy if exists "Nutzer sehen alle Einträge" on public.time_entries;
drop policy if exists "Nutzer verwalten ihre eigenen Einträge" on public.time_entries;

create policy time_entries_select
on public.time_entries for select
to authenticated
using (true);

create policy time_entries_insert
on public.time_entries for insert
to authenticated
with check ((select private.is_admin()) or (select auth.uid()) = user_id);

create policy time_entries_update
on public.time_entries for update
to authenticated
using ((select private.is_admin()) or (select auth.uid()) = user_id)
with check ((select private.is_admin()) or (select auth.uid()) = user_id);

create policy time_entries_delete
on public.time_entries for delete
to authenticated
using ((select private.is_admin()) or (select auth.uid()) = user_id);

drop policy if exists "Einsatzplan ist sichtbar" on public.assignments;
drop policy if exists "Kunden sind für alle Mitarbeiter sichtbar" on public.clients;
drop policy if exists "Bilder sind sichtbar" on public.project_images;
drop policy if exists "Project members are visible to all authenticated users" on public.project_members;
drop policy if exists "Notizen sind sichtbar" on public.project_notes;
drop policy if exists "Projekte sind für alle Mitarbeiter sichtbar" on public.projects;
drop policy if exists "Leistungen sind für alle sichtbar" on public.services;

drop policy if exists "Admins können Materialien löschen" on public.project_materials;
create policy project_materials_admin_delete
on public.project_materials for delete
to authenticated
using ((select private.is_admin()));

create policy project_materials_update
on public.project_materials for update
to authenticated
using (true)
with check (true);

create index if not exists absences_user_id_idx on public.absences (user_id);
create index if not exists assignments_project_id_idx on public.assignments (project_id);
create index if not exists assignments_user_id_idx on public.assignments (user_id);
create index if not exists project_images_project_id_idx on public.project_images (project_id);
create index if not exists project_materials_project_id_idx on public.project_materials (project_id);
create index if not exists project_materials_user_id_idx on public.project_materials (user_id);
create index if not exists project_members_user_id_idx on public.project_members (user_id);
create index if not exists project_notes_project_id_idx on public.project_notes (project_id);
create index if not exists projects_client_id_idx on public.projects (client_id);
create index if not exists services_project_id_idx on public.services (project_id);
create index if not exists time_entries_client_id_idx on public.time_entries (client_id);
create index if not exists time_entries_project_id_idx on public.time_entries (project_id);
create index if not exists time_entries_service_id_idx on public.time_entries (service_id);
create index if not exists time_entries_user_id_idx on public.time_entries (user_id);
