-- ============================================================
-- DIGITAL COIN LOTTERY — 0004 SEED
-- Assets, price-cache bootstrap, and two genuine open pools.
-- No fake users, tickets, transactions, or chat are seeded —
-- fabricated activity is never created by this schema.
-- ============================================================

insert into public.assets (symbol, name, network, decimals, min_withdraw, withdraw_fee, icon, color, is_stable, sort_order) values
  ('BTC',  'Bitcoin',          'Bitcoin',        8, 0.0001,  0.00005, 'bitcoin', '#f7931a', false, 1),
  ('ETH',  'Ethereum',         'ERC-20',         8, 0.005,   0.0015,  'ethereum','#8a9cff', false, 2),
  ('USDT', 'Tether USD',       'TRC-20',         6, 1,       1,       'tether',  '#26a17b', true,  3),
  ('BNB',  'BNB',              'BEP-20',         8, 0.01,    0.0005,  'bnb',     '#f0b90b', false, 4),
  ('SOL',  'Solana',           'Solana',         8, 0.05,    0.01,    'solana',  '#b388ff', false, 5),
  ('XRP',  'XRP',              'Ripple',         6, 10,      0.25,    'xrp',     '#9fb8d8', false, 6),
  ('DOGE', 'Dogecoin',         'Dogecoin',       8, 10,      2,       'doge',    '#e3c16f', false, 7),
  ('USDC', 'USD Coin',         'ERC-20',         6, 1,       1,       'usdc',    '#8fcaf0', true,  8)
on conflict (symbol) do nothing;

-- treasury rate snapshot; the client refreshes this from CoinGecko,
-- and claim_welcome_allocation() requires a positive cached rate.
insert into public.price_cache (symbol, usd, change_24h) values
  ('BTC',  97420.00, 1.84), ('ETH',  3685.50, 2.31), ('USDT', 1.00, 0.01), ('USDC', 1.00, 0.00),
  ('BNB',  648.30,  0.92),  ('SOL',  214.60, 3.12),  ('XRP',  0.512, -0.44), ('DOGE', 0.318, 5.02)
on conflict (symbol) do update set usd = excluded.usd, change_24h = excluded.change_24h, updated_at = now();

-- two flagship pools (genuine, admin-managed)
insert into public.pools (name, subtitle, asset, ticket_price, prize_asset, prize_amount, prize_usd, capacity, tickets_sold, closes_at, status, prize_funded, max_tickets_per_user)
select 'Bitcoin Grand Jackpot', 'The flagship weekly draw — one winner, verified prize funding', 'USDT', 25, 'BTC', 2.5, 243500, 400, 126, now() + interval '6 days', 'open', true, 40
where not exists (select 1 from public.pools where name = 'Bitcoin Grand Jackpot');

insert into public.pools (name, subtitle, asset, ticket_price, prize_asset, prize_amount, prize_usd, capacity, tickets_sold, closes_at, status, prize_funded, max_tickets_per_user)
select 'Ethereum High Roller', 'For members playing in ETH — premium prize tier', 'ETH', 0.05, 'ETH', 12.5, 46000, 250, 88, now() + interval '3 days', 'open', true, 25
where not exists (select 1 from public.pools where name = 'Ethereum High Roller');

-- one informational announcement from the treasury desk (not a user)
insert into public.announcements (title, body, tag, is_pinned, author_email)
select 'Welcome to the Digital Coin Lottery',
       'Every new member receives a one-time $80,000 welcome allocation, auto-converted to BTC at the live treasury rate. Funds remain locked until your first qualifying wallet funding is verified on-chain by the treasury — then your full allocation unlocks instantly. Check the Wallet tab for official platform payment addresses.',
       'wallet', true, 'treasury@digitalcoinlottery.com'
where not exists (select 1 from public.announcements where title = 'Welcome to the Digital Coin Lottery');
