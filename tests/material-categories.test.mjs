import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const admin = '10000000-0000-0000-0000-000000000001';
const employee = '10000000-0000-0000-0000-000000000002';
const otherEmployee = '10000000-0000-0000-0000-000000000003';
const project = '20000000-0000-0000-0000-000000000001';
const otherProject = '20000000-0000-0000-0000-000000000002';
const migration = await readFile(new URL('../supabase/migrations/20260903181043_add_material_categories.sql', import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.profiles (id uuid primary key, role text not null);
    create table public.projects (id uuid primary key);
    create table public.project_materials (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id),
      user_id uuid references public.profiles(id),
      name text not null,
      quantity text not null,
      created_at timestamptz default now()
    );
    create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
    $$;
    alter table public.project_materials enable row level security;
    create policy "Materialien sind für alle Mitarbeiter sichtbar" on public.project_materials for select to authenticated using (true);
    create policy "Mitarbeiter können Materialien hinzufügen" on public.project_materials for insert to authenticated with check (true);
    create policy project_materials_update on public.project_materials for update to authenticated using (true) with check (true);
    create policy project_materials_admin_delete on public.project_materials for delete to authenticated using (private.is_admin());
    grant select, insert, update, delete on public.project_materials to authenticated;
    insert into public.profiles(id, role) values
      ('${admin}', 'admin'), ('${employee}', 'employee'), ('${otherEmployee}', 'employee');
    insert into public.projects(id) values ('${project}'), ('${otherProject}');
    insert into public.project_materials(project_id, user_id, name, quantity)
      values ('${project}', '${employee}', 'Bestandsmaterial', '2 Stück');
  `);
  await db.exec(migration);
  return db;
}

async function asUser(db, userId) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
}

test('material category migration preserves existing material and protects category management', async () => {
  const db = await setup();
  try {
    assert.equal((await db.query('select category_id from project_materials')).rows[0].category_id, null);

    await asUser(db, employee);
    await assert.rejects(db.query("insert into material_categories(name) values('Kabel')"), /row-level security/);

    await db.exec('reset role');
    await asUser(db, admin);
    const category = (await db.query("insert into material_categories(name) values('Kabel') returning id")).rows[0].id;
    await assert.rejects(db.query("insert into material_categories(name) values(' kabel ')"), /unique/);
    await db.query('update project_materials set category_id = $1', [category]);
    await db.query('delete from material_categories where id = $1', [category]);
    assert.equal((await db.query('select category_id from project_materials')).rows[0].category_id, null);
  } finally {
    await db.close();
  }
});

test('employees can edit material content but cannot spoof ownership or project assignment', async () => {
  const db = await setup();
  try {
    await asUser(db, employee);
    await db.query("insert into project_materials(project_id,user_id,name,quantity) values($1,$2,'Leitung','10 m')", [project, employee]);
    await assert.rejects(
      db.query("insert into project_materials(project_id,user_id,name,quantity) values($1,$2,'Fremd','1')", [project, otherEmployee]),
      /row-level security/,
    );
    await db.query("update project_materials set name='Korrigiert' where name='Bestandsmaterial'");
    assert.equal((await db.query("select name from project_materials where quantity='2 Stück'")).rows[0].name, 'Korrigiert');
    await assert.rejects(db.query('update project_materials set user_id=$1', [otherEmployee]), /permission denied/);
    await assert.rejects(db.query('update project_materials set project_id=$1', [otherProject]), /permission denied/);
  } finally {
    await db.close();
  }
});
