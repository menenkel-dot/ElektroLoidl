alter table public.assignments
add column end_date date;

update public.assignments
set end_date = date
where end_date is null;

alter table public.assignments
alter column end_date set not null;

alter table public.assignments
add constraint assignments_date_range_check
check (end_date >= date);

create index assignments_date_range_idx
on public.assignments (date, end_date);

drop trigger if exists tr_on_time_entry_change on public.time_entries;
drop function if exists public.on_time_entry_change();
drop function if exists public.calculate_project_spent_value(uuid);

alter table public.projects
drop column budget_type,
drop column budget_value,
drop column spent_value;

alter table public.absences
add constraint absences_date_range_check
check (end_date >= start_date);

create or replace function private.protect_absence_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select private.is_admin()), false) then
    if tg_op = 'INSERT' and coalesce(new.status, '') <> 'pending' then
      raise exception using
        errcode = '42501',
        message = 'Nur Administratoren dürfen Abwesenheitsanträge genehmigen oder ablehnen.';
    end if;

    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      raise exception using
        errcode = '42501',
        message = 'Nur Administratoren dürfen Abwesenheitsanträge genehmigen oder ablehnen.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_absence_approval() from public, anon, authenticated;

drop trigger if exists protect_absence_approval on public.absences;
create trigger protect_absence_approval
before insert or update on public.absences
for each row
execute function private.protect_absence_approval();
