insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Bilder können hochgeladen werden" on public.project_images;
drop policy if exists project_images_select on public.project_images;
drop policy if exists project_images_insert on public.project_images;
drop policy if exists project_images_delete on public.project_images;

create policy project_images_select
on public.project_images for select
to authenticated
using (true);

create policy project_images_insert
on public.project_images for insert
to authenticated
with check (
  project_id is not null
  and exists (
    select 1
    from public.projects
    where projects.id = project_images.project_id
  )
);

create policy project_images_delete
on public.project_images for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists project_image_files_select on storage.objects;
drop policy if exists project_image_files_insert on storage.objects;
drop policy if exists project_image_files_delete on storage.objects;

create policy project_image_files_select
on storage.objects for select
to authenticated
using (bucket_id = 'project-images');

create policy project_image_files_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'project-images');

create policy project_image_files_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-images'
  and (select private.is_admin())
);
