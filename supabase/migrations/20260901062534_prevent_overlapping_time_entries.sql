create extension if not exists btree_gist with schema extensions;

alter table public.time_entries
add constraint time_entries_end_after_start
check (end_time > start_time);

alter table public.time_entries
add constraint time_entries_no_overlapping_user_times
exclude using gist (
  user_id with =,
  tsrange(date + start_time, date + end_time, '[)') with &&
);
