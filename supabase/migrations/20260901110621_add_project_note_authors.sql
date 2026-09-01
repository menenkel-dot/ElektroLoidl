alter table public.project_notes
add column if not exists user_id uuid default auth.uid();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_notes_user_id_fkey'
      and conrelid = 'public.project_notes'::regclass
  ) then
    alter table public.project_notes
    add constraint project_notes_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on delete set null;
  end if;
end;
$$;

create index if not exists project_notes_user_id_idx
on public.project_notes (user_id);

drop policy if exists "Notizen können erstellt werden" on public.project_notes;
drop policy if exists project_notes_select on public.project_notes;
drop policy if exists project_notes_insert on public.project_notes;

create policy project_notes_select
on public.project_notes for select
to authenticated
using (true);

create policy project_notes_insert
on public.project_notes for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and project_id is not null
  and exists (
    select 1
    from public.projects
    where projects.id = project_notes.project_id
  )
);
