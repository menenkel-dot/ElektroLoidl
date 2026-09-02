create or replace function private.sync_vacation_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_days integer;
  new_days integer;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and old.type = 'vacation'
     and old.status = 'approved'
  then
    old_days := (old.end_date - old.start_date) + 1;
    update public.profiles
    set vacation_used = greatest(0, coalesce(vacation_used, 0) - old_days)
    where id = old.user_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.type = 'vacation'
     and new.status = 'approved'
  then
    new_days := (new.end_date - new.start_date) + 1;
    update public.profiles
    set vacation_used = coalesce(vacation_used, 0) + new_days
    where id = new.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_vacation_balance()
from public, anon, authenticated;

drop trigger if exists on_absence_status_change on public.absences;
create trigger sync_vacation_balance
after insert or update or delete on public.absences
for each row
execute function private.sync_vacation_balance();

drop function if exists public.update_vacation_used();
