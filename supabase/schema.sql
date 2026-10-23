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

-- Fitness bands: tokens are encrypted by the server and can only be read with the service role (no policies on purpose).
create table if not exists device_connections (
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('whoop', 'polar', 'strava', 'coros')),
  tokens text not null,               -- encrypted JSON
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  primary key (user_id, provider)
);
create table if not exists oauth_states (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  provider text not null,
  created_at timestamptz not null default now()
);
alter table device_connections enable row level security;
alter table oauth_states enable row level security;

-- Payments (Razorpay). Written only by the server; runners cannot touch these rows.
create table if not exists payments (
  order_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  amount_paise integer not null,
  status text not null default 'created' check (status in ('created', 'paid')),
  payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table payments enable row level security;

-- If you ran this file before Strava was added, widen the allowed bands (safe to run again):
alter table device_connections drop constraint if exists device_connections_provider_check;
alter table device_connections add constraint device_connections_provider_check check (provider in ('whoop', 'polar', 'strava', 'coros'));
