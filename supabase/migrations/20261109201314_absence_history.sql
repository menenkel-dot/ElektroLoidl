create table public.absence_history (
  id bigint generated always as identity primary key,
  absence_id uuid not null references public.absences(id) on delete cascade,
  action text not null check (action in ('submitted', 'edited', 'approved', 'rejected', 'reopened')),
  occurred_at timestamptz,
  actor_name text,
  changes jsonb
);

create index absence_history_absence_id_id_idx
  on public.absence_history (absence_id, id);

alter table public.absence_history enable row level security;
revoke all on public.absence_history from public, anon, authenticated;
grant select on public.absence_history to authenticated;
revoke all on sequence public.absence_history_id_seq from public, anon, authenticated;

create policy absence_history_read on public.absence_history
for select to authenticated
using (exists (
  select 1 from public.absences a where a.id = absence_history.absence_id
));

-- Preserve the known creation time and status of legacy records without inventing attribution.
insert into public.absence_history (absence_id, action, occurred_at)
select id, 'submitted', created_at from public.absences;

insert into public.absence_history (absence_id, action)
select id, status from public.absences where status in ('approved', 'rejected');

create function private.record_absence_history()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_name text;
  event_time timestamptz := clock_timestamp();
  edits jsonb := '{}'::jsonb;
begin
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and row(old.type, old.start_date, old.end_date)
         is not distinct from row(new.type, new.start_date, new.end_date) then
    return new;
  end if;

  select nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') into caller_name
  from public.profiles p where p.id = caller_id;

  if tg_op = 'INSERT' then
    insert into public.absence_history (absence_id, action, occurred_at, actor_name)
    values (new.id, 'submitted', event_time, caller_name);
  elsif old.status = 'pending' then
    if old.type is distinct from new.type then
      edits := edits || jsonb_build_object('type', jsonb_build_array(old.type, new.type));
    end if;
    if row(old.start_date, old.end_date) is distinct from row(new.start_date, new.end_date) then
      edits := edits || jsonb_build_object(
        'period', jsonb_build_array(jsonb_build_array(old.start_date, old.end_date),
                                    jsonb_build_array(new.start_date, new.end_date))
      );
    end if;
    if edits <> '{}'::jsonb then
      insert into public.absence_history (absence_id, action, occurred_at, actor_name, changes)
      values (new.id, 'edited', event_time, caller_name, edits);
    end if;
  end if;

  if (tg_op = 'INSERT' and new.status in ('approved', 'rejected'))
     or (tg_op = 'UPDATE' and old.status is distinct from new.status
         and new.status in ('approved', 'rejected', 'pending')) then
    insert into public.absence_history (absence_id, action, occurred_at, actor_name)
    values (new.id, case when new.status = 'pending' then 'reopened' else new.status end,
            event_time, caller_name);
  end if;

  return new;
end;
$$;
revoke all on function private.record_absence_history() from public, anon, authenticated;

create trigger record_absence_history
after insert or update on public.absences
for each row execute function private.record_absence_history();
