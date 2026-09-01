alter table public.time_entries
add column if not exists material_recorded_confirmed boolean not null default false;

comment on column public.time_entries.material_recorded_confirmed is
'User confirmed that required material was recorded before saving the time entry.';
