create index if not exists project_notes_recent_idx on public.project_notes (created_at desc, id desc);
create index if not exists time_entries_project_date_idx on public.time_entries (project_id, date desc, start_time desc, id desc);

create function public.get_recent_project_notes(before_time timestamptz default null, before_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Nur Administratoren dürfen die Notizenübersicht abrufen.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc, n.id desc), '[]'::jsonb) into result
  from (
    select n.id, n.project_id, p.name as project_name, n.text, n.created_at,
      coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Verfasser nicht verfügbar') as author_name
    from public.project_notes n join public.projects p on p.id = n.project_id
    left join public.profiles u on u.id = n.user_id
    where before_time is null or (n.created_at, n.id) < (before_time, before_id)
    order by n.created_at desc, n.id desc limit 11
  ) n;
  return result;
end;
$$;

create function public.get_project_time_summary(target_project uuid, page_number integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Nur Administratoren dürfen Auftragszeiten aller Mitarbeiter abrufen.' using errcode = '42501';
  end if;
  if page_number < 0 then raise exception 'Ungültige Seite'; end if;
  return jsonb_build_object(
    'total_minutes', (select coalesce(sum(duration_minutes), 0) from public.time_entries where project_id = target_project),
    'count', (select count(*) from public.time_entries where project_id = target_project),
    'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.name), '[]'::jsonb) from (
      select e.user_id, coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Mitarbeiter nicht verfügbar') as name,
        sum(e.duration_minutes) as minutes
      from public.time_entries e left join public.profiles p on p.id = e.user_id
      where e.project_id = target_project group by e.user_id, p.first_name, p.last_name
    ) m),
    'entries', (select coalesce(jsonb_agg(to_jsonb(e) order by e.date desc, e.start_time desc, e.id desc), '[]'::jsonb) from (
      select e.id, e.date, e.start_time, e.end_time, e.duration_minutes, e.description,
        coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Mitarbeiter nicht verfügbar') as name
      from public.time_entries e left join public.profiles p on p.id = e.user_id
      where e.project_id = target_project order by e.date desc, e.start_time desc, e.id desc
      limit 25 offset page_number * 25
    ) e)
  );
end;
$$;
revoke all on function public.get_recent_project_notes(timestamptz, uuid) from public, anon;
revoke all on function public.get_project_time_summary(uuid, integer) from public, anon;
grant execute on function public.get_recent_project_notes(timestamptz, uuid) to authenticated;
grant execute on function public.get_project_time_summary(uuid, integer) to authenticated;
