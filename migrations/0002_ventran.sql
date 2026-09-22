create table if not exists profiles (
  user_id text primary key,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_hue integer not null default 140,
  cash double precision not null default 10000,
  deposited double precision not null default 10000,
  xp integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pools (
  market_id text primary key,
  q jsonb not null,
  b double precision not null,
  volume double precision not null
);

create table if not exists positions (
  user_id text not null,
  market_id text not null,
  outcome_id text not null,
  shares double precision not null,
  cost double precision not null,
  primary key (user_id, market_id, outcome_id)
);
create index if not exists positions_user_idx on positions (user_id);

create table if not exists fills (
  id serial primary key,
  user_id text not null,
  market_id text not null,
  outcome_id text not null,
  action text not null,
  shares double precision not null,
  cost double precision not null,
  price double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists fills_user_idx on fills (user_id, created_at desc);
create index if not exists fills_market_idx on fills (market_id, created_at desc);

create table if not exists comments (
  id serial primary key,
  user_id text not null,
  market_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_market_idx on comments (market_id, created_at desc);

create table if not exists follows (
  follower_id text not null,
  followee_id text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

create table if not exists watchlist (
  user_id text not null,
  market_id text not null,
  primary key (user_id, market_id)
);

create table if not exists limit_orders (
  id serial primary key,
  user_id text not null,
  market_id text not null,
  outcome_id text not null,
  side text not null,
  limit_price double precision not null,
  amount double precision not null,
  filled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists limits_open_idx on limit_orders (market_id, filled);

create table if not exists parlays (
  id serial primary key,
  user_id text not null,
  stake double precision not null,
  combined_price double precision not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists parlay_legs (
  parlay_id integer not null references parlays (id) on delete cascade,
  market_id text not null,
  outcome_id text not null,
  price double precision not null
);

create table if not exists alerts (
  id serial primary key,
  user_id text not null,
  market_id text not null,
  direction text not null,
  threshold double precision not null,
  triggered boolean not null default false
);

create table if not exists briefs (
  market_id text primary key,
  body text not null,
  created_at timestamptz not null default now()
);

insert into profiles (user_id, handle, display_name, bio, avatar_hue, cash, deposited, xp)
values
  ('bot-arbmax', 'arbmax', 'Arb Max', 'L2 native. Size only on Arbitrum flow.', 152, 18420, 10000, 1420),
  ('bot-cycle', 'cycle', 'Cycle', 'Post-halving skeptic. Sells consensus.', 12, 12640, 10000, 880),
  ('bot-rates', 'rates', 'Rates', 'FOMC watcher. Lives in the dots.', 210, 15110, 10000, 1040),
  ('bot-midterms', 'midterms', 'Midterms', 'Maps over narratives.', 38, 9800, 10000, 610)
on conflict (user_id) do nothing;

insert into positions (user_id, market_id, outcome_id, shares, cost)
values
  ('bot-arbmax', 'ventra-launch', 'yes', 420, 280),
  ('bot-arbmax', 'arb-tvl', 'yes', 310, 175),
  ('bot-cycle', 'btc-150k', 'no', 800, 460),
  ('bot-rates', 'fed-cut-oct', 'yes', 500, 305),
  ('bot-midterms', 'house-2026', 'yes', 220, 118)
on conflict do nothing;
