create table public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint material_categories_name_valid
    check (char_length(btrim(name)) between 1 and 80)
);

create unique index material_categories_name_unique_idx
  on public.material_categories (lower(btrim(name)));

alter table public.project_materials
  add column category_id uuid null;

alter table public.project_materials
  add constraint project_materials_category_id_fkey
  foreign key (category_id)
  references public.material_categories(id)
  on delete set null;

create index project_materials_category_id_idx
  on public.project_materials (category_id);

alter table public.material_categories enable row level security;

create policy material_categories_select
on public.material_categories for select
to authenticated
using (true);

create policy material_categories_admin_insert
on public.material_categories for insert
to authenticated
with check ((select private.is_admin()));

create policy material_categories_admin_update
on public.material_categories for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy material_categories_admin_delete
on public.material_categories for delete
to authenticated
using ((select private.is_admin()));

revoke all on table public.material_categories from anon;
revoke all on table public.material_categories from authenticated;
grant select, insert, update, delete on table public.material_categories to authenticated;
grant all on table public.material_categories to service_role;

drop policy if exists "Mitarbeiter können Materialien hinzufügen" on public.project_materials;
create policy project_materials_insert
on public.project_materials for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke update on table public.project_materials from authenticated;
grant update (name, quantity, category_id) on table public.project_materials to authenticated;

comment on table public.material_categories is
'Company-wide categories used to group materials across projects.';

comment on column public.project_materials.category_id is
'Optional company-wide material category. Null is displayed as uncategorized.';
