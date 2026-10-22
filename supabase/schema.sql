-- Last Mile: run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Every runner signs in anonymously, gets a user id, and can only see their own rows.

create table if not exists athletes (
  user_id uuid primary key references auth.users on delete cascade,
  account jsonb not null default '{}',
  saved jsonb,                       -- the answers and the plan
  updated_at timestamptz not null default now()
);

create table if not exists runs (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  data jsonb not null,
  ran_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists runs_user_ran_at on runs (user_id, ran_at desc);

create table if not exists subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null default 'free' check (status in ('free', 'active')),
  updated_at timestamptz not null default now()
);

alter table athletes enable row level security;
alter table runs enable row level security;
alter table subscriptions enable row level security;

create policy "own athlete" on athletes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own runs" on runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Runners can read their subscription but not change it: only the server (service role) writes it.
create policy "read own subscription" on subscriptions for select using (auth.uid() = user_id);
