alter table public.absences
add column comp_time_hours numeric not null default 0
check (comp_time_hours >= 0);

comment on column public.absences.comp_time_hours is
'Sollstunden, die bei Genehmigung eines Zeitausgleichs vom Überstundenkonto abgezogen wurden.';

create or replace function private.calculate_comp_time_hours(
  target_user_id uuid,
  range_start date,
  range_end date
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    coalesce(profile.target_hours_monthly, 160) /
    (
      select count(*)
      from pg_catalog.generate_series(
        pg_catalog.date_trunc('month', work_day)::date,
        (pg_catalog.date_trunc('month', work_day) + interval '1 month - 1 day')::date,
        interval '1 day'
      ) as month_days(month_day)
      where extract(isodow from month_day) < 6
    )
  ), 0)
  from public.profiles as profile
  cross join pg_catalog.generate_series(range_start, range_end, interval '1 day') as work_days(work_day)
  where profile.id = target_user_id
    and extract(isodow from work_day) < 6;
$$;

revoke all on function private.calculate_comp_time_hours(uuid, date, date)
from public, anon, authenticated;

create or replace function private.set_comp_time_hours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'comp_time' and new.status = 'approved' then
    new.comp_time_hours := private.calculate_comp_time_hours(
      new.user_id,
      new.start_date,
      new.end_date
    );
  else
    new.comp_time_hours := 0;
  end if;

  return new;
end;
$$;

revoke all on function private.set_comp_time_hours()
from public, anon, authenticated;

create or replace function private.sync_comp_time_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.comp_time_hours > 0 then
      update public.profiles
      set overtime_base = coalesce(overtime_base, 0) + old.comp_time_hours
      where id = old.user_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.comp_time_hours > 0 then
    update public.profiles
    set overtime_base = coalesce(overtime_base, 0) + old.comp_time_hours
    where id = old.user_id;
  end if;

  if new.comp_time_hours > 0 then
    update public.profiles
    set overtime_base = coalesce(overtime_base, 0) - new.comp_time_hours
    where id = new.user_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_comp_time_balance()
from public, anon, authenticated;

drop trigger if exists set_comp_time_hours on public.absences;
create trigger set_comp_time_hours
before insert or update on public.absences
for each row
execute function private.set_comp_time_hours();

drop trigger if exists sync_comp_time_balance on public.absences;
create trigger sync_comp_time_balance
after insert or update or delete on public.absences
for each row
execute function private.sync_comp_time_balance();
