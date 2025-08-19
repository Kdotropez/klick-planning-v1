-- Supabase schema for centralized planning storage and collaborative locking

-- Table: plannings (one row per shop/week)
create table if not exists public.plannings (
  shop_id text not null,
  week_key text not null,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint plannings_pkey primary key (shop_id, week_key)
);

-- Helpful index if you query by updated time
create index if not exists plannings_updated_at_idx on public.plannings (updated_at desc);

-- Table: planning_locks (collaborative lock per shop/week)
create table if not exists public.planning_locks (
  shop_id text not null,
  week_key text not null,
  user_id text not null,
  force_release_request timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_locks_pkey primary key (shop_id, week_key)
);

-- Keep only one active lock per shop/week
create index if not exists planning_locks_updated_at_idx on public.planning_locks (updated_at desc);

-- Row Level Security (RLS)
alter table public.plannings enable row level security;
alter table public.planning_locks enable row level security;

-- WARNING: The following permissive policies are for initial testing.
-- Tighten them before going to production (e.g., restrict by auth.uid()).

-- Allow read/write for anon key (client-side) for quick start
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plannings' and policyname = 'plannings_select_all'
  ) then
    create policy plannings_select_all on public.plannings for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plannings' and policyname = 'plannings_insert_all'
  ) then
    create policy plannings_insert_all on public.plannings for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plannings' and policyname = 'plannings_update_all'
  ) then
    create policy plannings_update_all on public.plannings for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'planning_locks' and policyname = 'locks_select_all'
  ) then
    create policy locks_select_all on public.planning_locks for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'planning_locks' and policyname = 'locks_insert_all'
  ) then
    create policy locks_insert_all on public.planning_locks for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'planning_locks' and policyname = 'locks_update_all'
  ) then
    create policy locks_update_all on public.planning_locks for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'planning_locks' and policyname = 'locks_delete_all'
  ) then
    create policy locks_delete_all on public.planning_locks for delete using (true);
  end if;
end $$;

-- Trigger to auto-update updated_at on upserts/updates for plannings
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists plannings_touch_updated_at on public.plannings;
create trigger plannings_touch_updated_at
before insert or update on public.plannings
for each row execute procedure public.touch_updated_at();

drop trigger if exists locks_touch_updated_at on public.planning_locks;
create trigger locks_touch_updated_at
before insert or update on public.planning_locks
for each row execute procedure public.touch_updated_at();



