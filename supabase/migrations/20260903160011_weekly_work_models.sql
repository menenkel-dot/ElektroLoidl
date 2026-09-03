-- One calculation engine for daily targets, absence charges and rolling balances.
-- Existing monthly contracts are snapshotted, not converted automatically.
alter table public.profiles add column accounting_since date not null
  default ((now() at time zone 'Europe/Berlin')::date);
update public.profiles set accounting_since = date_trunc('month', now() at time zone 'Europe/Berlin')::date;

create table public.work_time_models (
  user_id uuid not null references public.profiles(id) on delete cascade,
  effective_from date not null,
  daily_minutes integer[],
  monthly_hours numeric,
  holiday_profile text,
  primary key (user_id, effective_from),
  check ((daily_minutes is null and monthly_hours is not null and monthly_hours between 0 and 744 and holiday_profile is null)
    or (daily_minutes is not null and cardinality(daily_minutes) = 7 and array_ndims(daily_minutes) = 1
      and array_lower(daily_minutes, 1) = 1 and array_position(daily_minutes, null) is null
      and 0 <= all(daily_minutes) and 1440 >= all(daily_minutes) and monthly_hours is null
      and holiday_profile is not null and holiday_profile in ('BY', 'BY_MARIA', 'BY_AUGSBURG')))
);
alter table public.work_time_models enable row level security;
revoke all on public.work_time_models from public, anon, authenticated;
grant select on public.work_time_models to authenticated;
create policy work_time_models_read on public.work_time_models for select to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()));
insert into public.work_time_models(user_id, effective_from, monthly_hours)
select id, accounting_since, coalesce(target_hours_monthly, 160) from public.profiles;

create table private.work_model_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  changed_by uuid,
  created_at timestamptz not null default now(),
  before_state jsonb not null,
  after_state jsonb not null
);
alter table private.work_model_audit enable row level security;
revoke all on private.work_model_audit from public, anon, authenticated;

create function private.bavarian_holiday(d date, region text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare y integer := extract(year from d); a integer; b integer; c integer; h integer; l integer; m integer; easter date;
begin
  a := y % 19; b := y / 100; c := y % 100;
  h := (19*a+b-b/4-(b-(b+8)/25+1)/3+15) % 30;
  l := (32+2*(b%4)+2*(c/4)-h-c%4) % 7;
  m := (a+11*h+22*l)/451;
  easter := make_date(y, (h+l-7*m+114)/31, (h+l-7*m+114)%31+1);
  return to_char(d, 'MM-DD') = any(array['01-01','01-06','05-01','10-03','11-01','12-25','12-26'])
    or d = any(array[easter-2,easter+1,easter+39,easter+50,easter+60])
    or (region in ('BY_MARIA','BY_AUGSBURG') and to_char(d,'MM-DD')='08-15')
    or (region='BY_AUGSBURG' and to_char(d,'MM-DD')='08-08');
end;
$$;

create function private.day_target(uid uuid, d date, proposed integer[] default null, region text default null, since date default null)
returns numeric language plpgsql stable set search_path = '' as $$
declare model public.work_time_models; minutes integer[]; holidays text; hours numeric;
begin
  select * into model from public.work_time_models where user_id=uid and effective_from<=d order by effective_from desc limit 1;
  minutes := model.daily_minutes; holidays := model.holiday_profile;
  if proposed is not null and d>=since then minutes:=proposed; holidays:=region; end if;
  if minutes is not null then
    if private.bavarian_holiday(d, holidays) then return 0; end if;
    return minutes[extract(isodow from d)::integer];
  end if;
  if extract(isodow from d)>5 then return 0; end if;
  hours := model.monthly_hours;
  if hours is null then select coalesce(target_hours_monthly,160) into hours from public.profiles where id=uid; end if;
  return hours * 60 / (select count(*) from generate_series(date_trunc('month',d)::date,
    (date_trunc('month',d)+interval '1 month - 1 day')::date, interval '1 day') ds where extract(isodow from ds)<6);
end;
$$;

-- Per-day snapshots preserve exact refunds even after subsequent contract changes.
create function private.absence_charge(uid uuid, first_day date, last_day date, kind text,
  prior jsonb default null, replace_since date default null, proposed integer[] default null, region text default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare d date; minutes numeric; weekly boolean; days jsonb := '{}'::jsonb; item jsonb;
begin
  if last_day < first_day or last_day-first_day > 3660 then raise exception 'Ungültiger Abwesenheitszeitraum (maximal 10 Jahre).'; end if;
  for d in select first_day+i from generate_series(0,last_day-first_day) i loop
    if replace_since is not null and d<replace_since and prior ? d::text then
      item := prior->d::text;
    else
      minutes := private.day_target(uid,d,proposed,region,replace_since);
      select daily_minutes is not null into weekly from public.work_time_models
        where user_id=uid and effective_from<=d order by effective_from desc limit 1;
      weekly := coalesce(weekly,false) or (proposed is not null and d>=replace_since);
      item := jsonb_build_object('minutes',minutes,'vacation',case when kind='vacation' and (not weekly or minutes>0) then 1 else 0 end);
    end if;
    days := days || jsonb_build_object(d::text,item);
  end loop;
  return days;
end;
$$;

alter table public.absences add column charge_days jsonb;
alter table public.absences add column charged_vacation_days integer not null default 0 check (charged_vacation_days>=0);
alter table public.absences add column charge_revision uuid;
alter table public.absences add column charge_recalculate_from date;

-- Backfill without replaying existing financial triggers. The migration is atomic.
drop trigger if exists set_comp_time_hours on public.absences;
drop trigger if exists sync_comp_time_balance on public.absences;
drop trigger if exists sync_vacation_balance on public.absences;
update public.absences set charge_days=private.absence_charge(user_id,start_date,end_date,type),
  charged_vacation_days=case when type='vacation' then end_date-start_date+1 else 0 end
where status='approved';
-- Do not guess how historical charges were split when the old total no longer matches.
update public.absences a set charge_days=null where status='approved' and type='comp_time'
and abs(comp_time_hours*60 - (select coalesce(sum((value->>'minutes')::numeric),0) from jsonb_each(a.charge_days)))>0.00001;

create or replace function private.set_comp_time_hours()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize absence approvals with contract changes for this employee.
  perform 1 from public.profiles where id=new.user_id for update;
  if new.status='approved' then
    if tg_op='UPDATE' and old.status='approved' and new.user_id=old.user_id and new.type=old.type
      and new.start_date=old.start_date and new.end_date=old.end_date
      and new.charge_revision is not distinct from old.charge_revision then
      new.comp_time_hours:=old.comp_time_hours; new.charge_days:=old.charge_days;
      new.charged_vacation_days:=old.charged_vacation_days;
      new.charge_recalculate_from:=old.charge_recalculate_from;
      return new;
    end if;
    if exists(select 1 from public.absences a where a.id<>new.id and a.user_id=new.user_id
      and a.status='approved' and a.start_date<=new.end_date and a.end_date>=new.start_date) then
      raise exception 'Es besteht bereits eine genehmigte Abwesenheit in diesem Zeitraum.';
    end if;
    if tg_op='UPDATE' and new.charge_revision is distinct from old.charge_revision then
      if not coalesce((select private.is_admin()),false) then raise exception 'Nur Administratoren dürfen Belastungen neu berechnen.' using errcode='42501'; end if;
      if old.charge_days is null then raise exception 'Die alte Tagesaufteilung ist nicht eindeutig. Bitte Altbelastung vor der Umstellung prüfen.'; end if;
      new.charge_days:=private.absence_charge(new.user_id,new.start_date,new.end_date,new.type,old.charge_days,new.charge_recalculate_from);
    else
      new.charge_days:=private.absence_charge(new.user_id,new.start_date,new.end_date,new.type);
    end if;
    select case when new.type='comp_time' then coalesce(sum((value->>'minutes')::numeric),0)/60 else 0 end,
      coalesce(sum((value->>'vacation')::integer),0)
      into new.comp_time_hours,new.charged_vacation_days from jsonb_each(new.charge_days);
  else
    new.comp_time_hours:=0; new.charged_vacation_days:=0; new.charge_days:=null;
    new.charge_revision:=null; new.charge_recalculate_from:=null;
  end if;
  return new;
end;
$$;
create trigger set_comp_time_hours before insert or update on public.absences
for each row execute function private.set_comp_time_hours();
create trigger sync_comp_time_balance after insert or update or delete on public.absences
for each row execute function private.sync_comp_time_balance();

create or replace function private.sync_vacation_balance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.charged_vacation_days>0 then
    update public.profiles set vacation_used=greatest(0,coalesce(vacation_used,0)-old.charged_vacation_days) where id=old.user_id;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.charged_vacation_days>0 then
    update public.profiles set vacation_used=coalesce(vacation_used,0)+new.charged_vacation_days where id=new.user_id;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger sync_vacation_balance after insert or update or delete on public.absences
for each row execute function private.sync_vacation_balance();

create function private.work_balance(uid uuid, at_day date,
  proposed integer[] default null, region text default null, since date default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare p public.profiles; worked numeric; target numeric:=0; credit numeric:=0; adjustment numeric:=0;
  d date; a record; charge jsonb; item jsonb; active boolean; month_target numeric;
begin
  select * into strict p from public.profiles where id=uid;
  select coalesce(sum(duration_minutes),0), count(*)>0 into worked,active from public.time_entries
    where user_id=uid and date between p.accounting_since and at_day;
  select coalesce(sum(private.day_target(uid,ds::date,proposed,region,since)),0) into target
    from generate_series(p.accounting_since,at_day,interval '1 day') ds;
  -- Credit each date once, even if legacy data contains overlapping absences.
  for d in select ds::date from generate_series(p.accounting_since,at_day,interval '1 day') ds loop
    if exists(select 1 from public.absences where user_id=uid and status='approved' and start_date<=d and end_date>=d) then
      active:=true;
      select charge_days->d::text into item from public.absences where user_id=uid and status='approved'
        and start_date<=d and end_date>=d order by id limit 1;
      if proposed is not null and d>=since then
        credit:=credit+private.day_target(uid,d,proposed,region,since);
      else
        credit:=credit+coalesce((item->>'minutes')::numeric,private.day_target(uid,d));
      end if;
    end if;
  end loop;
  if proposed is not null then
    for a in select * from public.absences where user_id=uid and status='approved' and type='comp_time' and end_date>=since loop
      charge:=private.absence_charge(uid,a.start_date,a.end_date,a.type,a.charge_days,since,proposed,region);
      adjustment:=adjustment+a.comp_time_hours*60-(select sum((value->>'minutes')::numeric) from jsonb_each(charge));
    end loop;
  end if;
  select sum(private.day_target(uid,ds::date,proposed,region,since)) into month_target
    from generate_series(date_trunc('month',at_day)::date,(date_trunc('month',at_day)+interval '1 month - 1 day')::date,interval '1 day') ds;
  return jsonb_build_object('user_id',uid,'balance_hours',coalesce(p.overtime_base,0)+(adjustment+case when active then worked+credit-target else 0 end)/60,
    'today_target_hours',private.day_target(uid,at_day,proposed,region,since)/60,'month_target_hours',month_target/60,
    'accounting_since',p.accounting_since,'worked_hours',worked/60,'credited_hours',credit/60,'target_hours',target/60);
end;
$$;

create function private.read_work_balances()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Nicht authentifiziert' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(private.work_balance(id,(now() at time zone 'Europe/Berlin')::date)),'[]'::jsonb)
    from public.profiles where id=(select auth.uid()) or (select private.is_admin()));
end;
$$;
create function public.get_work_balances() returns jsonb language sql stable security invoker set search_path='' as $$
  select private.read_work_balances();
$$;

create function private.change_work_model(uid uuid, minutes integer[], region text, do_save boolean, expected_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare since date:=date_trunc('month',now() at time zone 'Europe/Berlin')::date;
  today date:=(now() at time zone 'Europe/Berlin')::date; before_state jsonb; result jsonb; token text;
  a record; charge jsonb; changes jsonb:='[]'::jsonb; vacation_delta integer:=0;
begin
  if (select auth.uid()) is null or not coalesce((select private.is_admin()),false) then
    raise exception 'Nur Administratoren dürfen Arbeitszeitmodelle ändern.' using errcode='42501'; end if;
  if minutes is null or cardinality(minutes)<>7 or array_ndims(minutes)<>1 or array_lower(minutes,1)<>1
    or array_position(minutes,null) is not null or not (0<=all(minutes) and 1440>=all(minutes))
    or region is null or region not in ('BY','BY_MARIA','BY_AUGSBURG') then raise exception 'Ungültiges Wochenmodell.'; end if;
  perform 1 from public.profiles where id=uid for update;
  if not found then raise exception 'Mitarbeiter nicht gefunden'; end if;
  before_state:=jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=uid),
    'models',(select jsonb_agg(to_jsonb(m) order by effective_from) from public.work_time_models m where user_id=uid),
    'absences',(select jsonb_agg(to_jsonb(absence_row) order by id) from public.absences absence_row where user_id=uid and end_date>=since),
    'entries',(select jsonb_agg(to_jsonb(e) order by id) from public.time_entries e where user_id=uid and date>=since));
  token:=md5(before_state::text||minutes::text||region||since::text);
  for a in select * from public.absences where user_id=uid and status='approved' and end_date>=since loop
    if a.charge_days is null then raise exception 'Eine Altbelastung hat keine eindeutige Tagesaufteilung. Bitte zuerst prüfen.'; end if;
    charge:=private.absence_charge(uid,a.start_date,a.end_date,a.type,a.charge_days,since,minutes,region);
    vacation_delta:=vacation_delta+a.charged_vacation_days-(select coalesce(sum((value->>'vacation')::integer),0) from jsonb_each(charge));
    changes:=changes||jsonb_build_array(jsonb_build_object('id',a.id,'type',a.type,'start_date',a.start_date,'end_date',a.end_date,
      'old_hours',a.comp_time_hours,'new_hours',case when a.type='comp_time' then (select sum((value->>'minutes')::numeric)/60 from jsonb_each(charge)) else 0 end,
      'old_days',a.charged_vacation_days,'new_days',(select sum((value->>'vacation')::integer) from jsonb_each(charge))));
  end loop;
  result:=jsonb_build_object('token',token,'effective_from',since,'before',private.work_balance(uid,today),
    'after',private.work_balance(uid,today,minutes,region,since),'absence_changes',changes,'vacation_refund_days',vacation_delta);
  if do_save then
    if expected_token is distinct from token then raise exception 'Die Daten haben sich geändert. Bitte Vorschau erneut laden.'; end if;
    insert into public.work_time_models(user_id,effective_from,daily_minutes,holiday_profile)
      values(uid,since,minutes,region) on conflict(user_id,effective_from) do update
      set daily_minutes=excluded.daily_minutes,holiday_profile=excluded.holiday_profile,monthly_hours=null;
    update public.absences set charge_revision=gen_random_uuid(),charge_recalculate_from=since
      where user_id=uid and status='approved' and end_date>=since;
    insert into private.work_model_audit(user_id,changed_by,before_state,after_state)
      values(uid,(select auth.uid()),before_state,result);
  end if;
  return result;
end;
$$;
create function public.preview_work_model(target_user uuid, daily_minutes integer[], holiday_profile text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.change_work_model(target_user,daily_minutes,holiday_profile,false);
$$;
create function public.save_work_model(target_user uuid, daily_minutes integer[], holiday_profile text, preview_token text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.change_work_model(target_user,daily_minutes,holiday_profile,true,preview_token);
$$;

-- Snapshot monthly edits too: older months must not change when a contract is edited.
create function private.snapshot_monthly_model() returns trigger language plpgsql security definer set search_path='' as $$
declare weekly boolean;
begin
  select daily_minutes is not null into weekly from public.work_time_models where user_id=new.id
    order by effective_from desc limit 1;
  if not coalesce(weekly,false) then
    insert into public.work_time_models(user_id,effective_from,monthly_hours)
    values(new.id,greatest(new.accounting_since,date_trunc('month',now() at time zone 'Europe/Berlin')::date),coalesce(new.target_hours_monthly,160))
    on conflict(user_id,effective_from) do update set monthly_hours=excluded.monthly_hours;
  end if;
  return new;
end;
$$;
create trigger snapshot_monthly_model after insert or update of target_hours_monthly on public.profiles
for each row execute function private.snapshot_monthly_model();

create or replace function public.protect_profile_privileged_fields()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid()) is not null and not (select private.is_admin()) and (
    new.role is distinct from old.role or new.permissions is distinct from old.permissions
    or new.target_hours_monthly is distinct from old.target_hours_monthly
    or new.vacation_total is distinct from old.vacation_total or new.vacation_used is distinct from old.vacation_used
    or new.overtime_base is distinct from old.overtime_base or new.accounting_since is distinct from old.accounting_since
  ) then raise exception 'Only administrators may change privileged profile fields' using errcode='42501'; end if;
  return new;
end;
$$;

-- Explicit grants: privileged implementations stay outside the exposed schema.
revoke all on function private.bavarian_holiday(date,text) from public,anon,authenticated;
revoke all on function private.day_target(uuid,date,integer[],text,date) from public,anon,authenticated;
revoke all on function private.absence_charge(uuid,date,date,text,jsonb,date,integer[],text) from public,anon,authenticated;
revoke all on function private.work_balance(uuid,date,integer[],text,date) from public,anon,authenticated;
revoke all on function private.read_work_balances() from public,anon;
revoke all on function private.change_work_model(uuid,integer[],text,boolean,text) from public,anon;
revoke all on function private.snapshot_monthly_model() from public,anon,authenticated;
revoke all on function public.get_work_balances() from public,anon;
revoke all on function public.preview_work_model(uuid,integer[],text) from public,anon;
revoke all on function public.save_work_model(uuid,integer[],text,text) from public,anon;
grant execute on function private.read_work_balances() to authenticated;
grant execute on function private.change_work_model(uuid,integer[],text,boolean,text) to authenticated;
grant execute on function public.get_work_balances() to authenticated;
grant execute on function public.preview_work_model(uuid,integer[],text) to authenticated;
grant execute on function public.save_work_model(uuid,integer[],text,text) to authenticated;
