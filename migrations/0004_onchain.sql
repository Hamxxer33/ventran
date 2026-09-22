create table if not exists chain_wallets (
  user_id text not null,
  address text not null,
  chain_id integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, address, chain_id)
);
create index if not exists chain_wallets_address_idx on chain_wallets (address);

create table if not exists chain_orders (
  id serial primary key,
  user_id text,
  wallet text not null,
  venue text not null,
  market_id text not null,
  outcome_id text not null,
  action text not null default 'buy',
  amount_usd double precision not null,
  odds text,
  fee_usd double precision not null default 0,
  status text not null,
  order_id text,
  tx_hash text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists chain_orders_wallet_idx on chain_orders (wallet, created_at desc);
create index if not exists chain_orders_order_idx on chain_orders (order_id);
