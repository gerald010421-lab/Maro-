-- ============================================================
-- DIGITAL COIN LOTTERY — 0001 CORE SCHEMA
-- PostgreSQL 15+ / Supabase. Apply with: supabase db push
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- ENUM-ish check domains (kept as text + checks for migration simplicity) ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or (char_length(username) between 3 and 24 and username ~ '^[A-Za-z0-9_.-]+$')),
  full_name text,
  avatar_color text not null default '#e2a62e',
  role text not null default 'user' check (role in ('user','admin')),
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  symbol text primary key,
  name text not null,
  network text not null,
  decimals integer not null default 8,
  min_withdraw numeric(38,18) not null default 0,
  withdraw_fee numeric(38,18) not null default 0,
  icon text not null default 'coin',
  color text not null default '#f0b73f',
  is_stable boolean not null default false,
  is_enabled boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null references public.assets(symbol),
  available numeric(38,18) not null default 0 check (available >= 0),
  locked numeric(38,18) not null default 0 check (locked >= 0),
  usd_rate numeric(18,8) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, asset)
);

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text not null default '',
  asset text not null references public.assets(symbol),
  ticket_price numeric(38,18) not null check (ticket_price > 0),
  prize_asset text not null references public.assets(symbol),
  prize_amount numeric(38,18) not null default 0,
  prize_usd numeric(18,2) not null default 0,
  capacity integer not null check (capacity > 0),
  tickets_sold integer not null default 0 check (tickets_sold >= 0),
  closes_at timestamptz,
  status text not null default 'open' check (status in ('open','closed','drawn','paid')),
  prize_funded boolean not null default false,
  draw_method text not null default 'verifiable random (SHA-256 of committed seed + blockhash)',
  min_tickets integer not null default 1,
  max_tickets_per_user integer not null default 50,
  winner_ticket uuid,
  winner_id uuid references auth.users(id),
  drawn_at timestamptz,
  payout_status text not null default 'pending' check (payout_status in ('pending','processing','paid')),
  payout_tx text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint capacity_not_exceeded check (tickets_sold <= capacity)
);

-- one row per purchase attempt; the key is the replay answer for multi-ticket buys
create table if not exists public.purchase_requests (
  idempotency_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  quantity integer not null,
  tx_ref text,
  total_charged numeric(38,18),
  asset text,
  ticket_ids uuid[] not null default '{}',
  ticket_numbers text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  price_paid numeric(38,18) not null,
  status text not null default 'active' check (status in ('active','won','lost','void')),
  is_winner boolean not null default false,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal','swap','ticket_purchase','welcome_credit','welcome_conversion','adjustment','prize_credit','refund')),
  asset text not null,
  amount numeric(38,18) not null check (amount > 0),
  counter_asset text,
  counter_amount numeric(38,18),
  fee numeric(38,18) not null default 0,
  direction text not null default 'debit' check (direction in ('credit','debit')),
  status text not null default 'completed' check (status in ('pending','completed','failed','review')),
  provider text not null default 'internal',
  provider_ref text,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- append-only audit trail for administrative balance adjustments
create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid not null references auth.users(id),
  asset text not null,
  amount numeric(38,18) not null check (amount <> 0),
  reason text not null check (char_length(reason) >= 8),
  actor_id uuid not null references auth.users(id),
  actor_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.welcome_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  usd_amount numeric(18,2) not null default 80000,
  rate numeric(18,8) not null,
  btc_amount numeric(38,18) not null,
  fee_usd numeric(18,8) not null default 0,
  conversion_ref text not null,
  status text not null default 'locked' check (status in ('locked','unlocked')),
  unlock_requirement_usd numeric(18,2) not null default 500,
  unlocked_at timestamptz,
  unlock_deposit_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_addresses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  purpose text not null default '',
  asset text not null,
  network text not null,
  address text not null,
  memo text,
  instructions text not null default '',
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  network text not null,
  amount numeric(38,18) not null check (amount > 0),
  usd_value numeric(18,8),
  tx_hash text unique,
  source_address text,
  status text not null default 'pending' check (status in ('pending','confirming','confirmed','credited','rejected')),
  confirmations integer not null default 0,
  required_confirmations integer not null default 3,
  platform_address_id uuid references public.platform_addresses(id),
  idempotency_key text unique,
  credited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  tag text not null default 'general' check (tag in ('general','lottery','wallet','maintenance','jackpot')),
  is_pinned boolean not null default false,
  author_id uuid references auth.users(id),
  author_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'info' check (kind in ('info','success','warning','prize','deposit','system')),
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'global' check (channel = 'global'),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  is_pinned boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- owner of the thread
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null default 'user' check (sender_role in ('user','admin')),
  body text not null check (char_length(body) between 1 and 1000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.price_cache (
  symbol text primary key,
  usd numeric(18,8) not null,
  change_24h numeric(10,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (bucket, window_start)
);

-- ---------- INDEXES ----------
create index if not exists idx_wallets_user on public.wallets(user_id);
create index if not exists idx_pools_status on public.pools(status);
create index if not exists idx_pools_closes on public.pools(closes_at);
create index if not exists idx_tickets_user on public.tickets(user_id, created_at desc);
create index if not exists idx_tickets_pool on public.tickets(pool_id);
create index if not exists idx_transactions_user on public.transactions(user_id, created_at desc);
create index if not exists idx_transactions_ref on public.transactions(ref);
create index if not exists idx_adjustments_user on public.adjustments(user_id, created_at desc);
create index if not exists idx_deposits_user on public.deposits(user_id, created_at desc);
create index if not exists idx_deposits_status on public.deposits(status);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_chat_created on public.chat_messages(channel, created_at desc);
create index if not exists idx_support_user on public.support_messages(user_id, created_at);
create index if not exists idx_announcements_pinned on public.announcements(is_pinned desc, created_at desc);

-- ---------- ADMIN CHECK (server-side, never trusts the client) ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and lower(email) = lower('Christianmark474@gmail.com')
  );
$$;

-- ---------- NEW USER BOOTSTRAP ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := 'user'; v_name text;
begin
  if lower(coalesce(new.email,'')) = lower('Christianmark474@gmail.com') then
    v_role := 'admin';
  end if;
  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,'user'), '@', 1));
  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email,''), v_name, v_role)
  on conflict (id) do update set email = excluded.email;
  insert into public.wallets (user_id, asset, usd_rate)
  select new.id, a.symbol, coalesce((select usd from public.price_cache p where p.symbol = a.symbol), 0)
  from public.assets a where a.is_enabled
  on conflict (user_id, asset) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_addresses_touch on public.platform_addresses;
create trigger trg_addresses_touch before update on public.platform_addresses for each row execute function public.touch_updated_at();

-- updated_by stamps for broadcast addresses
create or replace function public.stamp_platform_address() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists trg_addresses_stamp on public.platform_addresses;
create trigger trg_addresses_stamp before insert or update on public.platform_addresses for each row execute function public.stamp_platform_address();
