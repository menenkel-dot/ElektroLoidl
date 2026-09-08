-- Preserve legitimate pauses, but never trust an arbitrary duration from the client.
alter table public.time_entries add constraint time_entries_valid_duration
check (duration_minutes > 0 and duration_minutes <= round(extract(epoch from (end_time - start_time)) / 60));

-- Personal balances and contract details are visible to the owner and admins only.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using ((select private.is_admin()) or id = (select auth.uid()));

-- A deliberately narrow directory keeps names/avatars available for scheduling and notes.
create function private.employee_directory()
returns table (id uuid, first_name text, last_name text, avatar_url text, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name, p.avatar_url, p.role::text
  from public.profiles p
  where (select auth.uid()) is not null
    and exists (select 1 from public.profiles caller where caller.id = (select auth.uid()));
$$;
revoke all on function private.employee_directory() from public, anon;
grant execute on function private.employee_directory() to authenticated;

create function public.get_employee_directory()
returns table (id uuid, first_name text, last_name text, avatar_url text, role text)
language sql stable security invoker set search_path = '' as $$
  select * from private.employee_directory();
$$;
revoke all on function public.get_employee_directory() from public, anon;
grant execute on function public.get_employee_directory() to authenticated;

-- Qualify objects.name: unqualified name resolves to projects.name in the subquery.
drop policy project_image_files_select on storage.objects;
create policy project_image_files_select on storage.objects for select to authenticated
using (bucket_id = 'project-images' and exists (
  select 1 from public.projects p
  where p.id::text = (storage.foldername(objects.name))[1]
    and (select private.can_read_project_contents(p.id))
));
drop policy project_image_files_insert on storage.objects;
create policy project_image_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'project-images' and exists (
  select 1 from public.projects p
  where p.id::text = (storage.foldername(objects.name))[1]
    and (select private.project_is_active(p.id))
));
drop policy project_image_files_delete on storage.objects;
create policy project_image_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'project-images' and (select private.is_admin()) and exists (
  select 1 from public.projects p
  where p.id::text = (storage.foldername(objects.name))[1]
    and (select private.project_is_active(p.id))
));
