import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const admin = '10000000-0000-0000-0000-000000000001';
const employee = '10000000-0000-0000-0000-000000000002';
const otherEmployee = '10000000-0000-0000-0000-000000000003';
const project = '20000000-0000-0000-0000-000000000001';
const blockedProject = '20000000-0000-0000-0000-000000000002';
const migration = await readFile(new URL('../supabase/migrations/20260907145954_archive_projects.sql', import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema storage;
    grant usage on schema public, private, auth, storage to authenticated, service_role;

    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant execute on function auth.uid() to authenticated, service_role;
    create function storage.foldername(path text) returns text[] language sql stable as $$
      select string_to_array(path, '/')
    $$;

    create table public.profiles (
      id uuid primary key,
      role text not null,
      first_name text,
      last_name text,
      avatar_url text,
      vacation_total integer default 30,
      overtime_base numeric default 0
    );
    create table public.projects (
      id uuid primary key,
      client_id uuid,
      name text not null,
      created_at timestamptz not null default now()
    );
    create table public.assignments (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      user_id uuid not null references public.profiles(id),
      start_date date not null,
      end_date date not null
    );
    create table public.services (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      name text not null
    );
    create table public.project_members (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      user_id uuid not null references public.profiles(id)
    );
    create table public.project_notes (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      user_id uuid references public.profiles(id),
      text text not null,
      created_at timestamptz not null default now()
    );
    create table public.project_materials (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      user_id uuid references public.profiles(id),
      name text not null,
      quantity text not null
    );
    create table public.project_images (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      url text not null
    );
    create table public.time_entries (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      user_id uuid not null references public.profiles(id),
      date date not null,
      start_time time not null,
      end_time time not null,
      duration_minutes integer not null default 60,
      material_recorded_confirmed boolean not null default false
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null,
      name text not null
    );

    create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
    $$;
    grant execute on function private.is_admin() to authenticated, service_role;

    alter table public.projects enable row level security;
    alter table public.profiles enable row level security;
    create policy profiles_select on public.profiles for select to authenticated using (true);
    alter table public.assignments enable row level security;
    alter table public.services enable row level security;
    alter table public.project_members enable row level security;
    alter table public.project_notes enable row level security;
    alter table public.project_materials enable row level security;
    alter table public.project_images enable row level security;
    alter table public.time_entries enable row level security;
    alter table storage.objects enable row level security;

    create policy projects_select on public.projects for select to authenticated using (true);
    create policy projects_insert_admin on public.projects for insert to authenticated with check (private.is_admin());
    create policy projects_update_admin on public.projects for update to authenticated using (private.is_admin()) with check (private.is_admin());
    create policy projects_delete_admin on public.projects for delete to authenticated using (private.is_admin());
    create policy assignments_select on public.assignments for select to authenticated using (true);
    create policy assignments_insert_admin on public.assignments for insert to authenticated with check (private.is_admin());
    create policy assignments_update_admin on public.assignments for update to authenticated using (private.is_admin()) with check (private.is_admin());
    create policy assignments_delete_admin on public.assignments for delete to authenticated using (private.is_admin());
    create policy "Project members can be managed by all authenticated users" on public.project_members for all to authenticated using (true) with check (true);
    create policy "Leistungen können verwaltet werden" on public.services for all to authenticated using (true) with check (true);
    create policy project_notes_select on public.project_notes for select to authenticated using (true);
    create policy project_notes_insert on public.project_notes for insert to authenticated with check (user_id = auth.uid());
    create policy project_notes_update_own on public.project_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy "Materialien sind für alle Mitarbeiter sichtbar" on public.project_materials for select to authenticated using (true);
    create policy project_materials_insert on public.project_materials for insert to authenticated with check (user_id = auth.uid());
    create policy project_materials_update on public.project_materials for update to authenticated using (true) with check (true);
    create policy project_materials_admin_delete on public.project_materials for delete to authenticated using (private.is_admin());
    create policy project_images_select on public.project_images for select to authenticated using (true);
    create policy project_images_insert on public.project_images for insert to authenticated with check (true);
    create policy project_images_delete on public.project_images for delete to authenticated using (private.is_admin());
    create policy time_entries_select on public.time_entries for select to authenticated using (private.is_admin() or auth.uid() = user_id);
    create policy time_entries_insert on public.time_entries for insert to authenticated with check ((private.is_admin() or auth.uid() = user_id) and material_recorded_confirmed);
    create policy time_entries_update on public.time_entries for update to authenticated using (private.is_admin() or auth.uid() = user_id) with check (private.is_admin() or auth.uid() = user_id);
    create policy time_entries_delete on public.time_entries for delete to authenticated using (private.is_admin() or auth.uid() = user_id);
    create policy project_image_files_select on storage.objects for select to authenticated using (bucket_id = 'project-images');
    create policy project_image_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'project-images');
    create policy project_image_files_delete on storage.objects for delete to authenticated using (bucket_id = 'project-images' and private.is_admin());

    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;

    insert into public.profiles(id, role, first_name, last_name) values
      ('${admin}', 'admin', 'Ada', 'Admin'),
      ('${employee}', 'employee', 'Emil', 'Mitarbeiter'),
      ('${otherEmployee}', 'employee', 'Olivia', 'Andere');
    insert into public.projects(id, name) values
      ('${project}', 'Altbestand'),
      ('${blockedProject}', 'Laufender Auftrag');
    insert into public.project_members(project_id, user_id) values ('${project}', '${employee}');
    insert into public.services(project_id, name) values ('${project}', 'Montage');
    insert into public.project_notes(project_id, user_id, text) values ('${project}', '${employee}', 'Bestandsnotiz');
    insert into public.project_materials(project_id, user_id, name, quantity) values ('${project}', '${employee}', 'Kabel', '10 m');
    insert into public.project_images(project_id, url) values ('${project}', 'existing.jpg');
    insert into public.time_entries(project_id, user_id, date, start_time, end_time, material_recorded_confirmed)
      values ('${project}', '${employee}', current_date - 2, '08:00', '10:00', true);
    insert into public.assignments(project_id, user_id, start_date, end_date)
      values ('${project}', '${employee}', current_date - 3, current_date - 1),
             ('${blockedProject}', '${employee}', current_date, current_date + 1);
    insert into storage.objects(bucket_id, name) values ('project-images', '${project}/existing.jpg');
  `);
  await db.exec(migration);
  await db.exec(await readFile(new URL('../supabase/migrations/20260907201059_fix_audit_findings.sql', import.meta.url), 'utf8'));
  return db;
}

async function asUser(db, userId) {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
}

test('existing projects stay open and only admins can archive them', async () => {
  const db = await setup();
  try {
    assert.equal((await db.query('select count(*)::int as count from projects where archived_at is null')).rows[0].count, 2);

    await asUser(db, employee);
    const employeeUpdate = await db.query('update projects set archived_at = now() where id = $1 returning id', [project]);
    assert.equal(employeeUpdate.rows.length, 0);

    await asUser(db, admin);
    const archived = (await db.query('update projects set archived_at = now() where id = $1 returning archived_at, archived_by', [project])).rows[0];
    assert.ok(archived.archived_at);
    assert.equal(archived.archived_by, admin);
  } finally {
    await db.close();
  }
});

test('today or future assignments block archiving while past assignments do not', async () => {
  const db = await setup();
  try {
    await asUser(db, admin);
    await assert.rejects(
      db.query('update projects set archived_at = now() where id = $1', [blockedProject]),
      /heutige oder zukünftige Einsätze/,
    );
    await db.query('update assignments set end_date = current_date - 1 where project_id = $1', [blockedProject]);
    const result = await db.query('update projects set archived_at = now() where id = $1 returning archived_at', [blockedProject]);
    assert.ok(result.rows[0].archived_at);
  } finally {
    await db.close();
  }
});

test('archived projects are read-only, but admins can correct existing time entries', async () => {
  const db = await setup();
  try {
    await asUser(db, admin);
    await db.query('update projects set archived_at = now() where id = $1', [project]);

    await asUser(db, employee);
    assert.equal((await db.query('select count(*)::int as count from projects where id = $1', [project])).rows[0].count, 1);
    assert.equal((await db.query('select count(*)::int as count from project_notes where project_id = $1', [project])).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::int as count from project_images where project_id = $1', [project])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from storage.objects where name = $1", [`${project}/existing.jpg`])).rows[0].count, 0);
    await assert.rejects(db.query("insert into project_notes(project_id,user_id,text) values($1,$2,'Neu')", [project, employee]), /row-level security/);
    await assert.rejects(db.query("insert into project_materials(project_id,user_id,name,quantity) values($1,$2,'Dose','1')", [project, employee]), /row-level security/);
    await assert.rejects(db.query("insert into time_entries(project_id,user_id,date,start_time,end_time,material_recorded_confirmed) values($1,$2,current_date,'10:00','11:00',true)", [project, employee]), /row-level security/);
    await db.query("update time_entries set end_time='11:00' where project_id=$1", [project]);
    assert.equal((await db.query('select end_time::text from time_entries where project_id=$1', [project])).rows[0].end_time, '10:00:00');

    await asUser(db, admin);
    await db.query("update time_entries set end_time='11:00' where project_id=$1", [project]);
    assert.equal((await db.query('select end_time::text from time_entries where project_id=$1', [project])).rows[0].end_time, '11:00:00');
    await assert.rejects(db.query("insert into time_entries(project_id,user_id,date,start_time,end_time,material_recorded_confirmed) values($1,$2,current_date,'12:00','13:00',true)", [project, employee]), /row-level security/);
  } finally {
    await db.close();
  }
});

test('reactivation restores writes and permanent deletion requires prior archiving', async () => {
  const db = await setup();
  try {
    await asUser(db, admin);
    await assert.rejects(db.query('delete from projects where id = $1', [project]), /vor dem endgültigen Löschen archiviert/);
    await db.query('update projects set archived_at = now() where id = $1', [project]);
    await db.query('update projects set archived_at = null where id = $1', [project]);

    await asUser(db, employee);
    await db.query("insert into project_notes(project_id,user_id,text) values($1,$2,'Nach Reaktivierung')", [project, employee]);

    await asUser(db, admin);
    await db.query('update projects set archived_at = now() where id = $1', [project]);
    await db.query('delete from projects where id = $1', [project]);
    assert.equal((await db.query('select count(*)::int as count from projects where id = $1', [project])).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('employees can no longer change project membership or services', async () => {
  const db = await setup();
  try {
    await asUser(db, employee);
    await assert.rejects(db.query('insert into project_members(project_id,user_id) values($1,$2)', [project, otherEmployee]), /row-level security/);
    await assert.rejects(db.query("insert into services(project_id,name) values($1,'Manipuliert')", [project]), /row-level security/);
  } finally {
    await db.close();
  }
});

test('employee can read only own private profile, directory exposes names only, admin can read all', async () => {
  const db = await setup();
  try {
    await asUser(db, employee);
    assert.deepEqual((await db.query('select id from profiles')).rows.map(p => p.id), [employee]);
    const directory = (await db.query('select * from get_employee_directory()')).rows;
    assert.equal(directory.length, 3);
    assert.deepEqual(Object.keys(directory[0]).sort(), ['avatar_url', 'first_name', 'id', 'last_name', 'role']);
    assert.equal(directory.find(p => p.id === otherEmployee).first_name, 'Olivia');
    await asUser(db, admin);
    assert.equal((await db.query('select * from profiles')).rows.length, 3);
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(db.query('select * from get_employee_directory()'), /permission denied/);
  } finally { await db.close(); }
});

test('time durations cannot exceed attendance or become nonpositive, legitimate pauses survive', async () => {
  const db = await setup();
  try {
    await asUser(db, employee);
    for (const minutes of [-10, 0, 121]) {
      await assert.rejects(db.query('update time_entries set duration_minutes=$1 where user_id=$2', [minutes, employee]), /time_entries_valid_duration/);
    }
    await db.query('update time_entries set duration_minutes=90 where user_id=$1', [employee]);
    assert.equal((await db.query('select duration_minutes from time_entries')).rows[0].duration_minutes, 90);
    await assert.rejects(db.query("insert into time_entries(project_id,user_id,date,start_time,end_time,duration_minutes,material_recorded_confirmed) values($1,$2,current_date,'14:00','15:00',600,true)", [project, employee]), /time_entries_valid_duration/);
    await assert.rejects(db.query("update time_entries set end_time='08:30' where user_id=$1", [employee]), /time_entries_valid_duration/);
  } finally { await db.close(); }
});

test('image storage uses file folder, supports active reads/uploads and admin archive reads', async () => {
  const db = await setup();
  try {
    await asUser(db, employee);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await db.query("insert into storage.objects(bucket_id,name) values('project-images',$1)", [`${project}/new.jpg`]);
    await db.query("insert into project_images(project_id,url) values($1,$2)", [project, `${project}/new.jpg`]);
    assert.equal((await db.query("delete from project_images where url=$1 returning id", [`${project}/new.jpg`])).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-images','Altbestand/spoof.jpg')"), /row-level security/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('other',$1)", [`${project}/other.jpg`]), /row-level security/);
    await asUser(db, admin);
    await db.query("delete from storage.objects where name=$1", [`${project}/new.jpg`]);
    await db.query("delete from project_images where url=$1", [`${project}/new.jpg`]);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    assert.equal((await db.query('select * from project_images')).rows.length, 1);
    await db.query('update projects set archived_at=now() where id=$1', [project]);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-images',$1)", [`${project}/archived.jpg`]), /row-level security/);
    await asUser(db, employee);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-images',$1)", [`${project}/archived.jpg`]), /row-level security/);
  } finally { await db.close(); }
});
