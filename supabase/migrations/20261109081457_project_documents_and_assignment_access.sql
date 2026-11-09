create index if not exists project_members_project_user_idx
  on public.project_members (project_id, user_id);

-- The lookup bypasses RLS to avoid recursion through projects, members and assignments.
create or replace function private.project_is_active(target_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.projects p
      where p.id = target_project and p.archived_at is null
    )
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.project_members m
        where m.project_id = target_project and m.user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.assignments a
        where a.project_id = target_project and a.user_id = (select auth.uid())
      )
    );
$$;

create or replace function private.can_reference_project(target_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_read_project_contents(target_project);
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 10485760, array[
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

create policy project_documents_read on storage.objects for select to authenticated
using (bucket_id = 'project-documents' and exists (
  select 1 from public.projects p
  where p.id::text = (storage.foldername(objects.name))[1]
));

create policy project_documents_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and array_length(storage.foldername(objects.name), 1) = 1
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(objects.name))[1]
      and (select private.project_is_active(p.id))
  )
);

-- Admins also need Storage DELETE on archives for permanent project deletion.
create policy project_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'project-documents' and (select private.is_admin()) and exists (
  select 1 from public.projects p
  where p.id::text = (storage.foldername(objects.name))[1]
));

create function private.prevent_project_delete_with_documents()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'project-documents'
      and o.name like old.id::text || '/%'
  ) then
    raise exception 'Bitte zuerst die Auftragsdokumente entfernen.' using errcode = '23514';
  end if;
  return old;
end;
$$;
revoke all on function private.prevent_project_delete_with_documents() from public, anon, authenticated;

create trigger prevent_project_delete_with_documents
before delete on public.projects for each row
execute function private.prevent_project_delete_with_documents();
