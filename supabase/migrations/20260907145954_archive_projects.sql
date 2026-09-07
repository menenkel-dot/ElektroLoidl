alter table public.projects
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles(id) on delete set null;

create index projects_archived_at_created_at_idx
  on public.projects (archived_at, created_at desc);
create index projects_archived_by_idx
  on public.projects (archived_by);
create index assignments_project_end_date_idx
  on public.assignments (project_id, end_date);
create index time_entries_project_user_idx
  on public.time_entries (project_id, user_id);
create index assignments_project_user_idx
  on public.assignments (project_id, user_id);

create or replace function private.project_is_active(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.projects
      where id = target_project and archived_at is null
    );
$$;

create or replace function private.can_reference_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    (select private.is_admin())
    or exists (
      select 1 from public.projects
      where id = target_project and archived_at is null
    )
    or exists (
      select 1 from public.time_entries
      where project_id = target_project and user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.assignments
      where project_id = target_project and user_id = (select auth.uid())
    )
  );
$$;

create or replace function private.can_read_project_contents(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and ((select private.is_admin()) or (select private.project_is_active(target_project)));
$$;

revoke all on function private.project_is_active(uuid) from public, anon;
revoke all on function private.can_reference_project(uuid) from public, anon;
revoke all on function private.can_read_project_contents(uuid) from public, anon;
grant execute on function private.project_is_active(uuid) to authenticated, service_role;
grant execute on function private.can_reference_project(uuid) to authenticated, service_role;
grant execute on function private.can_read_project_contents(uuid) to authenticated, service_role;

create or replace function public.enforce_project_archive_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.archived_at is null then
      raise exception 'Offene Aufträge müssen vor dem endgültigen Löschen archiviert werden.' using errcode = '23514';
    end if;
    return old;
  end if;

  if old.archived_at is null and new.archived_at is not null then
    if exists (
      select 1 from public.assignments
      where project_id = old.id
        and end_date >= (now() at time zone 'Europe/Berlin')::date
    ) then
      raise exception 'Der Auftrag hat noch heutige oder zukünftige Einsätze. Bitte diese zuerst entfernen oder umplanen.' using errcode = '23514';
    end if;
    new.archived_at := now();
    new.archived_by := (select auth.uid());
    return new;
  end if;

  if old.archived_at is not null and new.archived_at is null then
    if new.name is distinct from old.name or new.client_id is distinct from old.client_id then
      raise exception 'Der archivierte Auftrag muss vor weiteren Änderungen reaktiviert werden.' using errcode = '23514';
    end if;
    new.archived_by := null;
    return new;
  end if;

  if old.archived_at is not null then
    raise exception 'Der archivierte Auftrag muss vor weiteren Änderungen reaktiviert werden.' using errcode = '23514';
  end if;

  new.archived_by := null;
  return new;
end;
$$;

drop trigger if exists enforce_project_archive_state on public.projects;
create trigger enforce_project_archive_state
before update or delete on public.projects
for each row execute function public.enforce_project_archive_state();

revoke all on function public.enforce_project_archive_state() from public, anon, authenticated;

drop policy if exists projects_select on public.projects;
create policy projects_select
on public.projects for select
to authenticated
using ((select private.can_reference_project(id)));

drop policy if exists "Project members can be managed by all authenticated users" on public.project_members;
drop policy if exists project_members_select on public.project_members;
drop policy if exists project_members_insert_admin on public.project_members;
drop policy if exists project_members_update_admin on public.project_members;
drop policy if exists project_members_delete_admin on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
using ((select private.can_read_project_contents(project_id)));
create policy project_members_insert_admin on public.project_members for insert to authenticated
with check ((select private.is_admin()) and (select private.project_is_active(project_id)));
create policy project_members_update_admin on public.project_members for update to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)))
with check ((select private.is_admin()) and (select private.project_is_active(project_id)));
create policy project_members_delete_admin on public.project_members for delete to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)));

drop policy if exists "Leistungen können verwaltet werden" on public.services;
drop policy if exists services_select on public.services;
drop policy if exists services_insert_admin on public.services;
drop policy if exists services_update_admin on public.services;
drop policy if exists services_delete_admin on public.services;
create policy services_select on public.services for select to authenticated
using ((select private.can_read_project_contents(project_id)));
create policy services_insert_admin on public.services for insert to authenticated
with check ((select private.is_admin()) and (select private.project_is_active(project_id)));
create policy services_update_admin on public.services for update to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)))
with check ((select private.is_admin()) and (select private.project_is_active(project_id)));
create policy services_delete_admin on public.services for delete to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)));

drop policy if exists assignments_select on public.assignments;
drop policy if exists assignments_insert_admin on public.assignments;
drop policy if exists assignments_update_admin on public.assignments;
drop policy if exists assignments_delete_admin on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
using ((select private.can_read_project_contents(project_id)));
create policy assignments_insert_admin on public.assignments for insert to authenticated
with check ((select private.is_admin()) and (select private.project_is_active(project_id)));
create policy assignments_update_admin on public.assignments for update to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)))
with check ((select private.is_admin()) and (select private.project_is_active(project_id)));
create policy assignments_delete_admin on public.assignments for delete to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)));

drop policy if exists time_entries_insert on public.time_entries;
drop policy if exists time_entries_update on public.time_entries;
drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_insert on public.time_entries for insert to authenticated
with check (
  ((select private.is_admin()) or (select auth.uid()) = user_id)
  and material_recorded_confirmed is true
  and (select private.project_is_active(project_id))
);
create policy time_entries_update on public.time_entries for update to authenticated
using (
  ((select private.is_admin()) or (select auth.uid()) = user_id)
  and ((select private.is_admin()) or (select private.project_is_active(project_id)))
)
with check (
  ((select private.is_admin()) or (select auth.uid()) = user_id)
  and ((select private.is_admin()) or (select private.project_is_active(project_id)))
);
create policy time_entries_delete on public.time_entries for delete to authenticated
using (
  (select private.is_admin())
  or ((select auth.uid()) = user_id and (select private.project_is_active(project_id)))
);

drop policy if exists project_notes_select on public.project_notes;
drop policy if exists project_notes_insert on public.project_notes;
drop policy if exists project_notes_update_own on public.project_notes;
create policy project_notes_select on public.project_notes for select to authenticated
using ((select private.can_read_project_contents(project_id)));
create policy project_notes_insert on public.project_notes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.project_is_active(project_id))
);
create policy project_notes_update_own on public.project_notes for update to authenticated
using (user_id = (select auth.uid()) and (select private.project_is_active(project_id)))
with check (user_id = (select auth.uid()) and (select private.project_is_active(project_id)));

drop policy if exists "Materialien sind für alle Mitarbeiter sichtbar" on public.project_materials;
drop policy if exists project_materials_select on public.project_materials;
drop policy if exists project_materials_insert on public.project_materials;
drop policy if exists project_materials_update on public.project_materials;
drop policy if exists project_materials_admin_delete on public.project_materials;
create policy project_materials_select on public.project_materials for select to authenticated
using ((select private.can_read_project_contents(project_id)));
create policy project_materials_insert on public.project_materials for insert to authenticated
with check ((select auth.uid()) = user_id and (select private.project_is_active(project_id)));
create policy project_materials_update on public.project_materials for update to authenticated
using ((select private.project_is_active(project_id)))
with check ((select private.project_is_active(project_id)));
create policy project_materials_admin_delete on public.project_materials for delete to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)));

drop policy if exists project_images_select on public.project_images;
drop policy if exists project_images_insert on public.project_images;
drop policy if exists project_images_delete on public.project_images;
create policy project_images_select on public.project_images for select to authenticated
using ((select private.can_read_project_contents(project_id)));
create policy project_images_insert on public.project_images for insert to authenticated
with check ((select private.project_is_active(project_id)));
create policy project_images_delete on public.project_images for delete to authenticated
using ((select private.is_admin()) and (select private.project_is_active(project_id)));

drop policy if exists project_image_files_select on storage.objects;
drop policy if exists project_image_files_insert on storage.objects;
drop policy if exists project_image_files_delete on storage.objects;
create policy project_image_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and (select private.can_read_project_contents(p.id))
  )
);
create policy project_image_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and (select private.project_is_active(p.id))
  )
);
create policy project_image_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'project-images'
  and (select private.is_admin())
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and (select private.project_is_active(p.id))
  )
);

create or replace function public.get_recent_project_notes(before_time timestamptz default null, before_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Nur Administratoren dürfen die Notizenübersicht abrufen.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc, n.id desc), '[]'::jsonb) into result
  from (
    select n.id, n.project_id, p.name as project_name, n.text, n.created_at,
      coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Verfasser nicht verfügbar') as author_name
    from public.project_notes n join public.projects p on p.id = n.project_id
    left join public.profiles u on u.id = n.user_id
    where p.archived_at is null
      and (before_time is null or (n.created_at, n.id) < (before_time, before_id))
    order by n.created_at desc, n.id desc limit 11
  ) n;
  return result;
end;
$$;

comment on column public.projects.archived_at is 'Null for open projects; timestamp when archived.';
comment on column public.projects.archived_by is 'Administrator who most recently archived the project.';
