drop policy if exists project_notes_update_own on public.project_notes;

create policy project_notes_update_own
on public.project_notes for update
to authenticated
using (
  user_id = (select auth.uid())
)
with check (
  user_id = (select auth.uid())
  and project_id is not null
  and exists (
    select 1
    from public.projects
    where projects.id = project_notes.project_id
  )
);

revoke update on table public.project_notes from authenticated;
grant update (text) on table public.project_notes to authenticated;
