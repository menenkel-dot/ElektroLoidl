import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const migration = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const admin = '10000000-0000-0000-0000-000000000001';
const employee = '10000000-0000-0000-0000-000000000002';

async function setup(beforeMigration) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    grant usage on schema auth,private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles (id uuid primary key,first_name text,last_name text,role text,
      target_hours_monthly numeric default 160,overtime_base numeric default 20,vacation_total integer default 30,
      vacation_used integer default 0,permissions jsonb default '{}');
    create table public.projects(id uuid primary key default gen_random_uuid(), name text);
    create table public.project_notes(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects,
      user_id uuid references public.profiles,text text,created_at timestamptz default now());
    create table public.time_entries(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles,
      project_id uuid references public.projects,date date,start_time time,end_time time,duration_minutes integer,description text);
    create table public.absences(id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles,
      type text,status text,start_date date,end_date date);
    create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    grant select,update on public.profiles to authenticated;
    grant select,insert,update,delete on public.absences,public.time_entries,public.project_notes,public.projects to authenticated;
    alter table public.profiles enable row level security;
    create policy profiles_read on public.profiles for select to authenticated using(true);
    create policy profiles_write on public.profiles for update to authenticated using(private.is_admin() or id=auth.uid());
    alter table public.absences enable row level security;
    alter table public.time_entries enable row level security;
    create policy time_read on public.time_entries for select to authenticated using(private.is_admin() or user_id=auth.uid());
    create policy time_write on public.time_entries for insert to authenticated with check(private.is_admin() or user_id=auth.uid());
    create function public.protect_profile_privileged_fields() returns trigger language plpgsql as $$ begin return new; end $$;
    create trigger protect_profile_privileged_fields before update on public.profiles for each row execute function public.protect_profile_privileged_fields();
    create function public.update_vacation_used() returns trigger language plpgsql as $$ begin return new; end $$;
    insert into public.profiles(id,role,first_name) values ('${admin}','admin','Admin'),('${employee}','employee','Mitarbeiter');
  `);
  await db.exec(await migration('20260831215417_lock_down_absence_requests'));
  await db.exec(await migration('20260901191754_deduct_approved_comp_time_from_overtime'));
  await db.exec(await migration('20260902074223_restore_balances_when_absences_are_deleted'));
  if (beforeMigration) await beforeMigration(db);
  await db.exec(await migration('20260903160010_admin_project_insights'));
  await db.exec(await migration('20260903160011_weekly_work_models'));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${admin}',false);`);
  return db;
}

const scalar = async (db, sql, args = []) => Object.values((await db.query(sql,args)).rows[0])[0];
async function convert(db, who = employee, minutes = [510,510,510,510,300,0,0], region = 'BY') {
  const preview = await scalar(db, 'select public.preview_work_model($1,$2,$3)', [who,minutes,region]);
  await scalar(db,'select public.save_work_model($1,$2,$3,$4)',[who,minutes,region,preview.token]);
  return preview;
}

test('weekly model: preview, charges, exact refunds, permissions and persistent balance', async () => {
  const db = await setup();
  try {
    const today = await scalar(db,"select (now() at time zone 'Europe/Berlin')::date::text");
    await db.exec('reset role');
    const friday = await scalar(db,"select ds::date::text from generate_series(date_trunc('month',now()),date_trunc('month',now())+interval '1 month - 1 day',interval '1 day') ds where extract(isodow from ds)=5 and not private.bavarian_holiday(ds::date,'BY') limit 1");
    await db.exec('set role authenticated');
    // Existing approved legacy debit is replaced, not charged a second time.
    const absence = await scalar(db,"insert into absences(user_id,type,status,start_date,end_date) values($1,'comp_time','approved',$2,$2) returning id",[employee,friday]);
    const preview = await convert(db);
    assert.equal(preview.absence_changes[0].new_hours,5);
    const actual=(await scalar(db,'select get_work_balances()')).find(b=>b.user_id===employee);
    assert.ok(Math.abs(actual.balance_hours-preview.after.balance_hours)<0.000001);
    assert.equal(Number(await scalar(db,'select overtime_base from profiles where id=$1',[employee])),15);
    await db.query("update absences set status='approved' where id=$1",[absence]);
    assert.equal(Number(await scalar(db,'select overtime_base from profiles where id=$1',[employee])),15);
    await db.query('delete from absences where id=$1',[absence]);
    assert.equal(Number(await scalar(db,'select overtime_base from profiles where id=$1',[employee])),20);
    // No activity: no immediate artificial negative balance.
    const balances = await scalar(db,'select get_work_balances()');
    assert.equal(balances.find(b=>b.user_id===employee).balance_hours,20);
    // Stale preview must not write a contract.
    const stale = await scalar(db,'select preview_work_model($1,$2,$3)',[employee,[480,480,480,480,480,0,0],'BY']);
    await db.query('update profiles set overtime_base=21 where id=$1',[employee]);
    await assert.rejects(scalar(db,'select save_work_model($1,$2,$3,$4)',[employee,[480,480,480,480,480,0,0],'BY',stale.token]),/Vorschau/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[employee]);
    await assert.rejects(db.query('update profiles set overtime_base=900 where id=$1',[employee]),/administrators/);
    await assert.rejects(scalar(db,'select preview_work_model($1,$2,$3)',[employee,[480,480,480,480,480,0,0],'BY']),/Administrator/);
    await assert.rejects(db.query('insert into work_time_models(user_id,effective_from,monthly_hours) values($1,$2,1)',[employee,today]),/permission denied/);
    assert.equal((await scalar(db,'select get_work_balances()')).length,1);
    await assert.rejects(scalar(db,'select get_recent_project_notes()'),/Administrator/);
    await assert.rejects(scalar(db,'select get_project_time_summary(gen_random_uuid())'),/Administrator/);
    // Date-target tests run as DB owner only; helpers are not callable by employees.
    await assert.rejects(scalar(db,"select private.day_target($1,'2026-09-04')",[employee]),/permission denied/);
    await db.exec('reset role');
    await db.query('update profiles set accounting_since=$1 where id=$2',['2026-09-01',employee]);
    await db.query('delete from work_time_models where user_id=$1',[employee]);
    await db.query("insert into work_time_models(user_id,effective_from,daily_minutes,holiday_profile) values($1,'2026-09-01',array[510,510,510,510,300,0,0],'BY')",[employee]);
    assert.equal(Number(await scalar(db,"select private.day_target($1,'2026-09-04')",[employee])),300);
    assert.equal(Number(await scalar(db,"select private.day_target($1,'2026-09-07')",[employee])),510);
    assert.equal(Number(await scalar(db,"select private.day_target($1,'2026-09-05')",[employee])),0);
    await db.query("insert into time_entries(user_id,date,duration_minutes) values($1,'2026-09-01',600)",[employee]);
    const september = await scalar(db,"select private.work_balance($1,'2026-09-30')",[employee]);
    const october = await scalar(db,"select private.work_balance($1,'2026-10-01')",[employee]);
    assert.equal(Number((september.balance_hours-october.balance_hours).toFixed(2)),8.5);
    const january = await scalar(db,"select private.work_balance($1,'2027-01-01')",[employee]);
    const december = await scalar(db,"select private.work_balance($1,'2026-12-31')",[employee]);
    assert.equal(january.balance_hours,december.balance_hours);
  } finally { await db.close(); }
});

test('Bavarian holidays, leave counts and minute precision',async()=>{
  const db=await setup();
  try {
    await db.exec('reset role');
    for (const date of ['2026-01-01','2026-01-06','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-06-04','2026-10-03','2026-11-01','2026-12-25','2026-12-26']) {
      assert.equal(await scalar(db,'select private.bavarian_holiday($1,$2)',[date,'BY']),true,date);
    }
    assert.equal(await scalar(db,"select private.bavarian_holiday('2026-08-15','BY')"),false);
    assert.equal(await scalar(db,"select private.bavarian_holiday('2026-08-15','BY_MARIA')"),true);
    assert.equal(await scalar(db,"select private.bavarian_holiday('2026-08-08','BY_MARIA')"),false);
    assert.equal(await scalar(db,"select private.bavarian_holiday('2026-08-08','BY_AUGSBURG')"),true);
    const charge=await scalar(db,"select private.absence_charge($1,'2026-12-24','2026-12-28','vacation',null,'2026-01-01',array[510,510,510,510,300,0,0],'BY')",[employee]);
    assert.equal(Object.values(charge).reduce((s,d)=>s+d.vacation,0),2);
    assert.equal(charge['2026-12-25'].minutes,0);
    assert.equal(Number(await scalar(db,"select private.day_target($1,'2026-09-04',array[0,0,0,0,301,0,0],'BY','2026-01-01')",[employee])),301);
  } finally {await db.close();}
});

test('project totals include all pages and notes have deterministic cursors',async()=>{
  const db=await setup();
  try {
    const project=await scalar(db,"insert into projects(name) values('Testauftrag') returning id");
    await db.query("insert into time_entries(project_id,user_id,date,start_time,end_time,duration_minutes) select $1,$2,'2026-09-01','08:00','09:00',60 from generate_series(1,30)",[project,employee]);
    const page=await scalar(db,'select get_project_time_summary($1,0)',[project]);
    assert.equal(page.count,30); assert.equal(page.total_minutes,1800); assert.equal(page.entries.length,25);
    assert.equal((await scalar(db,'select get_project_time_summary($1,1)',[project])).entries.length,5);
    await db.query("insert into project_notes(project_id,user_id,text) select $1,$2,'Notiz '||i from generate_series(1,15) i",[project,employee]);
    const notes=await scalar(db,'select get_recent_project_notes()');
    assert.equal(notes.length,11);
    const rest=await scalar(db,'select get_recent_project_notes($1,$2)',[notes[9].created_at,notes[9].id]);
    assert.equal(rest.length,5); assert.equal(new Set([...notes.slice(0,10),...rest].map(n=>n.id)).size,15);
  } finally {await db.close();}
});

test('migration preserves balances; conversion preserves prior-month snapshots and exact cancellation',async()=>{
  let oldBase; let absence; let first; let last;
  const db=await setup(async db=>{
    first=await scalar(db,"select (date_trunc('month',now())::date-1)::text");
    last=await scalar(db,"select (date_trunc('month',now())::date+1)::text");
    absence=await scalar(db,"insert into absences(user_id,type,status,start_date,end_date) values($1,'comp_time','approved',$2,$3) returning id",[employee,first,last]);
    oldBase=await scalar(db,'select overtime_base from profiles where id=$1',[employee]);
  });
  try {
    assert.equal(await scalar(db,'select overtime_base from profiles where id=$1',[employee]),oldBase);
    const oldDays=await scalar(db,'select charge_days from absences where id=$1',[absence]);
    await convert(db);
    const newDays=await scalar(db,'select charge_days from absences where id=$1',[absence]);
    assert.deepEqual(newDays[first],oldDays[first]);
    await db.query('delete from absences where id=$1',[absence]);
    assert.equal(Number(await scalar(db,'select overtime_base from profiles where id=$1',[employee])),20);
    // A changed contract must not alter refunds for an earlier month.
    const vacation=await scalar(db,"insert into absences(user_id,type,status,start_date,end_date) values($1,'vacation','approved','2026-12-24','2026-12-28') returning id",[employee]);
    assert.equal(Number(await scalar(db,'select vacation_used from profiles where id=$1',[employee])),2);
    await assert.rejects(scalar(db,"insert into absences(user_id,type,status,start_date,end_date) values($1,'sick','approved','2026-12-24','2026-12-24') returning id",[employee]),/bereits eine genehmigte/);
    await db.query("update absences set status='rejected' where id=$1",[vacation]);
    assert.equal(Number(await scalar(db,'select vacation_used from profiles where id=$1',[employee])),0);
    await db.query("update absences set status='approved' where id=$1",[vacation]);
    assert.equal(Number(await scalar(db,'select vacation_used from profiles where id=$1',[employee])),2);
  } finally {await db.close();}
});

test('ambiguous historical debit blocks conversion; zero targets stay zero',async()=>{
  const db=await setup(async db=>{
    await db.query("insert into absences(user_id,type,status,start_date,end_date) values($1,'comp_time','approved',date_trunc('month',now())::date,date_trunc('month',now())::date+7)",[employee]);
    // Simulate a historical contract change after the original deduction.
    await db.query('update profiles set target_hours_monthly=100 where id=$1',[employee]);
  });
  try {
    await assert.rejects(convert(db),/Tagesaufteilung/);
    await db.query('update profiles set target_hours_monthly=0 where id=$1',[admin]);
    const balance=(await scalar(db,'select get_work_balances()')).find(b=>b.user_id===admin);
    assert.equal(balance.today_target_hours,0); assert.equal(balance.month_target_hours,0);
    for(const invalid of [[],[1,2,3],[0,0,0,0,-1,0,0],[0,0,0,0,1441,0,0],[0,0,0,0,null,0,0]]) {
      await assert.rejects(scalar(db,'select preview_work_model($1,$2,$3)',[admin,invalid,'BY']),/Ungültiges/);
    }
    await db.exec('set role anon');
    await assert.rejects(scalar(db,'select get_work_balances()'),/permission denied/);
  } finally {await db.close();}
});
