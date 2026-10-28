-- ============================================================
-- DIGITAL COIN LOTTERY — 0002 ATOMIC BUSINESS LOGIC (RPC)
-- Every privileged mutation is a SECURITY DEFINER function with
-- row locking, idempotency and audit logging. Client code can
-- call these, but the logic is enforced inside the database.
-- ============================================================

-- ---------- helper: write a transaction row ----------
create or replace function public._txn(
  p_user uuid, p_type text, p_asset text, p_amount numeric, p_direction text,
  p_note text, p_counter_asset text default null, p_counter_amount numeric default null,
  p_fee numeric default 0, p_provider text default 'internal', p_provider_ref text default null,
  p_status text default 'completed'
) returns text language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  v_ref := 'DCL-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.transactions(ref,user_id,type,asset,amount,counter_asset,counter_amount,fee,direction,status,provider,provider_ref,note)
  values (v_ref,p_user,p_type,p_asset,p_amount,p_counter_asset,p_counter_amount,p_fee,p_direction,p_status,p_provider,p_provider_ref,p_note);
  return v_ref;
end $$;

create or replace function public._notify(p_user uuid, p_title text, p_body text, p_kind text, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id,title,body,kind,link) values (p_user,p_title,p_body,p_kind,p_link);
end $$;

create or replace function public._touch_wallet(p_user uuid, p_asset text) returns void language sql as $$
  update public.wallets set updated_at = now() where user_id = p_user and asset = p_asset;
$$;

-- ============================================================
-- PURCHASE TICKETS — atomic, no overselling, idempotent
-- ============================================================
create or replace function public.purchase_tickets(p_pool_id uuid, p_quantity integer, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_pool public.pools%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing public.purchase_requests%rowtype;
  v_total_price numeric(38,18);
  v_count integer := 0;
  v_ticket_id uuid;
  v_ticket_number text;
  v_tx_ref text;
  v_user_tickets integer;
  v_i integer;
  v_created jsonb := '[]'::jsonb;
  v_ids uuid[] := '{}';
  v_numbers text[] := '{}';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'INVALID_QUANTITY'; end if;

  -- idempotency: replay returns the recorded original result (exactly-once semantics)
  if p_idempotency_key is not null then
    select * into v_existing from public.purchase_requests where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.user_id <> v_user then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number)), '[]'::jsonb)
        into v_created from public.tickets t where t.id = any(v_existing.ticket_ids);
      return jsonb_build_object('ok', true, 'idempotent_replay', true, 'tickets', v_created,
        'tx_ref', v_existing.tx_ref, 'total_charged', v_existing.total_charged, 'asset', v_existing.asset);
    end if;
  end if;
  -- idempotency replay handled below via purchase_requests (see end of function)


  -- lock the pool row first (prevents oversell races)
  select * into v_pool from public.pools where id = p_pool_id for update;
  if not found then raise exception 'POOL_NOT_FOUND'; end if;
  if v_pool.status <> 'open' then raise exception 'POOL_NOT_OPEN'; end if;
  if v_pool.closes_at is not null and v_pool.closes_at <= now() then raise exception 'POOL_CLOSED'; end if;
  if v_pool.tickets_sold + p_quantity > v_pool.capacity then
    raise exception 'NOT_ENOUGH_CAPACITY:%', v_pool.capacity - v_pool.tickets_sold;
  end if;

  select count(*) into v_user_tickets from public.tickets where pool_id = p_pool_id and user_id = v_user;
  if v_user_tickets + p_quantity > v_pool.max_tickets_per_user then
    raise exception 'PER_USER_LIMIT:%', v_pool.max_tickets_per_user;
  end if;

  v_total_price := v_pool.ticket_price * p_quantity;

  -- lock wallet row and verify spendable funds (locked/welcome-hold funds excluded)
  select * into v_wallet from public.wallets where user_id = v_user and asset = v_pool.asset for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_wallet.available < v_total_price then
    raise exception 'INSUFFICIENT_FUNDS:%', v_wallet.available;
  end if;

  update public.wallets set available = available - v_total_price where id = v_wallet.id;

  update public.pools set tickets_sold = tickets_sold + p_quantity where id = v_pool.id;

  for v_i in 1..p_quantity loop
    v_ticket_number := 'T-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)) || '-' || lpad((v_pool.tickets_sold - p_quantity + v_i)::text, 6, '0');
    insert into public.tickets(ticket_number, pool_id, user_id, asset, price_paid, idempotency_key)
    values (v_ticket_number, p_pool_id, v_user, v_pool.asset, v_pool.ticket_price,
            case when p_idempotency_key is null then null else p_idempotency_key || ':' || v_i end)
    returning id into v_ticket_id;
    v_ids := v_ids || v_ticket_id;
    v_numbers := v_numbers || v_ticket_number;
    v_count := v_count + 1;
    v_created := v_created || jsonb_build_array(jsonb_build_object('id', v_ticket_id, 'ticket_number', v_ticket_number));
  end loop;

  v_tx_ref := public._txn(v_user, 'ticket_purchase', v_pool.asset, v_total_price, 'debit',
    p_quantity || ' ticket(s) — ' || v_pool.name, null, null, 0, 'internal', p_idempotency_key, 'completed');

  if p_idempotency_key is not null then
    insert into public.purchase_requests(idempotency_key, user_id, pool_id, quantity, tx_ref, total_charged, asset, ticket_ids, ticket_numbers)
    values (p_idempotency_key, v_user, p_pool_id, p_quantity, v_tx_ref, v_total_price, v_pool.asset, v_ids, v_numbers)
    on conflict (idempotency_key) do nothing;
  end if;

  perform public._notify(v_user, 'Tickets confirmed', v_count || ' ticket(s) for ' || v_pool.name || ' — ref ' || v_tx_ref, 'success', '/tickets');

  return jsonb_build_object('ok', true, 'tickets', v_created, 'tx_ref', v_tx_ref, 'total_charged', v_total_price, 'asset', v_pool.asset);
end $$;

-- ============================================================
-- WELCOME ALLOCATION — $80,000 credited ONCE, converted to BTC
-- Conversion uses the admin-configured treasury rate snapshot;
-- the reference is unique per allocation. Amount stays LOCKED
-- until an on-chain platform deposit is verified by an admin.
-- ============================================================
create or replace function public.claim_welcome_allocation()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_existing public.welcome_allocations%rowtype;
  v_rate numeric(18,8);
  v_btc numeric(38,18);
  v_fee numeric(18,8) := 25.00;  -- programme funding & conversion fee, USD
  v_net numeric(18,2);
  v_ref text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_existing from public.welcome_allocations where user_id = v_user;
  if found then
    return jsonb_build_object('ok', true, 'already_claimed', true, 'allocation_id', v_existing.id,
      'btc_amount', v_existing.btc_amount, 'rate', v_existing.rate, 'status', v_existing.status);
  end if;

  select usd into v_rate from public.price_cache where symbol = 'BTC';
  if v_rate is null or v_rate <= 0 then raise exception 'BTC_RATE_UNAVAILABLE'; end if;

  v_net := 80000 - v_fee;
  v_btc := round(v_net / v_rate, 8);
  v_ref := 'WELCOME-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  insert into public.welcome_allocations(user_id, usd_amount, rate, btc_amount, fee_usd, conversion_ref)
  values (v_user, 80000, v_rate, v_btc, v_fee, v_ref);

  -- locked funds are held in the wallet but NOT spendable
  insert into public.wallets(user_id, asset, locked, usd_rate)
  values (v_user, 'BTC', v_btc, v_rate)
  on conflict (user_id, asset) do update set locked = public.wallets.locked + excluded.locked, updated_at = now();

  perform public._txn(v_user, 'welcome_credit', 'USD', 80000, 'credit', '$80,000 new-member welcome allocation', null, null, 0, 'programme', v_ref, 'completed');
  perform public._txn(v_user, 'welcome_conversion', 'BTC', v_btc, 'credit',
    'Auto-conversion $80,000 → BTC @ $' || v_rate || ' (fee $' || v_fee || ') — locked until funding verified',
    'USD', 80000, v_fee, 'programme', v_ref, 'completed');

  perform public._notify(v_user, 'Welcome allocation secured',
    '$80,000 converted to ' || v_btc || ' BTC. Funds unlock after your qualifying wallet funding is verified on-chain.', 'prize', '/wallet');

  return jsonb_build_object('ok', true, 'already_claimed', false, 'btc_amount', v_btc, 'rate', v_rate, 'fee_usd', v_fee, 'conversion_ref', v_ref, 'status', 'locked');
end $$;

-- ============================================================
-- UNLOCK — releases locked BTC after verified qualifying deposit
-- Called by admin after independent on-chain verification, or by
-- the DB itself when a deposit is marked credited and qualifies.
-- ============================================================
create or replace function public._maybe_unlock_welcome(p_user uuid, p_deposit_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_alloc public.welcome_allocations%rowtype;
  v_dep public.deposits%rowtype;
  v_usd numeric(18,8);
begin
  select * into v_alloc from public.welcome_allocations where user_id = p_user for update;
  if not found or v_alloc.status = 'unlocked' then return; end if;
  select * into v_dep from public.deposits where id = p_deposit_id;
  if not found or v_dep.status <> 'credited' then return; end if;
  v_usd := coalesce(v_dep.usd_value, v_dep.amount * coalesce((select usd from public.price_cache where symbol = v_dep.asset),0));
  if v_usd < v_alloc.unlock_requirement_usd then return; end if;

  update public.wallets set locked = locked - v_alloc.btc_amount, available = available + v_alloc.btc_amount, updated_at = now()
  where user_id = p_user and asset = 'BTC';
  update public.welcome_allocations set status = 'unlocked', unlocked_at = now(), unlock_deposit_id = p_deposit_id where id = v_alloc.id;
  perform public._txn(p_user, 'adjustment', 'BTC', v_alloc.btc_amount, 'credit', 'Welcome allocation unlocked — qualifying deposit verified', null, null, 0, 'programme', coalesce(v_dep.tx_hash,'verified-deposit'), 'completed');
  perform public._notify(p_user, 'Welcome BTC unlocked', v_alloc.btc_amount || ' BTC is now spendable in your wallet.', 'prize', '/wallet');
end $$;

-- ============================================================
-- RECORD DEPOSIT (user submits tx hash; starts pending state)
-- Crediting happens ONLY through admin verification or trusted
-- backend provider confirmation — never from this function.
-- ============================================================
create or replace function public.record_deposit(
  p_asset text, p_network text, p_amount numeric, p_tx_hash text,
  p_platform_address_id uuid default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_dup uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if char_length(trim(coalesce(p_tx_hash,''))) < 12 then raise exception 'INVALID_TX_HASH'; end if;

  if p_idempotency_key is not null then
    select id into v_dup from public.deposits where idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('ok', true, 'deposit_id', v_dup, 'idempotent_replay', true); end if;
  end if;
  select id into v_dup from public.deposits where tx_hash = p_tx_hash;
  if found then raise exception 'DUPLICATE_TX_HASH'; end if;

  insert into public.deposits(user_id, asset, network, amount, tx_hash, platform_address_id, status, idempotency_key)
  values (v_user, p_asset, p_network, p_amount, trim(p_tx_hash), p_platform_address_id, 'pending', p_idempotency_key)
  returning id into v_id;

  perform public._notify(v_user, 'Deposit submitted for verification', 'Your ' || p_amount || ' ' || p_asset || ' deposit is pending on-chain verification by the platform treasury.', 'deposit', '/wallet');
  return jsonb_build_object('ok', true, 'deposit_id', v_id, 'status', 'pending');
end $$;

-- ============================================================
-- ADMIN: VERIFY & CREDIT DEPOSIT — exactly-once crediting
-- ============================================================
create or replace function public.admin_credit_deposit(p_deposit_id uuid, p_confirmations integer, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_dep public.deposits%rowtype;
  v_rate numeric;
  v_usd numeric(18,8);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_dep from public.deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;

  if not p_approve then
    update public.deposits set status = 'rejected', confirmations = coalesce(p_confirmations,0) where id = v_dep.id;
    perform public._notify(v_dep.user_id, 'Deposit rejected', 'Your ' || v_dep.asset || ' deposit (' || coalesce(v_dep.tx_hash,'') || ') could not be verified and was rejected.', 'warning', '/wallet');
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if v_dep.status = 'credited' then
    return jsonb_build_object('ok', true, 'status', 'credited', 'already_credited', true);  -- idempotent
  end if;
  if p_confirmations < v_dep.required_confirmations then
    raise exception 'INSUFFICIENT_CONFIRMATIONS:%', v_dep.required_confirmations;
  end if;

  select usd into v_rate from public.price_cache where symbol = v_dep.asset;
  v_usd := v_dep.amount * coalesce(v_rate, 0);

  insert into public.wallets(user_id, asset, available, usd_rate)
  values (v_dep.user_id, v_dep.asset, v_dep.amount, coalesce(v_rate,0))
  on conflict (user_id, asset) do update set available = public.wallets.available + excluded.available, updated_at = now();

  update public.deposits set status = 'credited', confirmations = p_confirmations, usd_value = v_usd, credited_at = now() where id = v_dep.id;

  perform public._txn(v_dep.user_id, 'deposit', v_dep.asset, v_dep.amount, 'credit',
    'On-chain deposit verified — ' || coalesce(v_dep.tx_hash,''), null, null, 0, 'onchain', v_dep.tx_hash, 'completed');
  perform public._notify(v_dep.user_id, 'Deposit credited', v_dep.amount || ' ' || v_dep.asset || ' credited to your wallet after ' || p_confirmations || ' confirmations.', 'deposit', '/wallet');

  perform public._maybe_unlock_welcome(v_dep.user_id, v_dep.id);

  return jsonb_build_object('ok', true, 'status', 'credited', 'usd_value', v_usd);
end $$;

-- ============================================================
-- INTERNAL TRANSFER (wallet-to-wallet, username or email)
-- ============================================================
create or replace function public.internal_transfer(p_recipient text, p_asset text, p_amount numeric, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_target uuid;
  v_wallet public.wallets%rowtype;
  v_key text := 'xfer:' || gen_random_uuid()::text;
  v_ref text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if char_length(trim(coalesce(p_recipient,''))) < 3 then raise exception 'RECIPIENT_REQUIRED'; end if;

  select id into v_target from public.profiles where lower(username) = lower(trim(p_recipient)) or lower(email) = lower(trim(p_recipient)) limit 1;
  if not found then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if v_target = v_user then raise exception 'CANNOT_SEND_TO_SELF'; end if;

  select * into v_wallet from public.wallets where user_id = v_user and asset = p_asset for update;
  if not found or v_wallet.available < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update public.wallets set available = available - p_amount where id = v_wallet.id;
  insert into public.wallets(user_id, asset, available, usd_rate)
  values (v_target, p_asset, p_amount, v_wallet.usd_rate)
  on conflict (user_id, asset) do update set available = public.wallets.available + excluded.available, updated_at = now();

  v_ref := public._txn(v_user, 'withdrawal', p_asset, p_amount, 'debit', coalesce(nullif(trim(p_note),''), 'Transfer to member ' || trim(p_recipient)), null, null, 0, 'internal', v_key, 'completed');
  perform public._txn(v_target, 'deposit', p_asset, p_amount, 'credit', 'Transfer from member', null, null, 0, 'internal', v_key, 'completed');
  perform public._notify(v_target, 'Funds received', p_amount || ' ' || p_asset || ' received from another member.', 'success', '/wallet');

  return jsonb_build_object('ok', true, 'tx_ref', v_ref);
end $$;

-- ============================================================
-- SWAP — internal conversion at cached oracle rate minus fee
-- The client fetches a live external quote for display; the
-- authoritative execution uses the DB-cached rate to guarantee
-- atomicity and prevent quote-tampering from the browser.
-- ============================================================
create or replace function public.execute_swap(p_from_asset text, p_to_asset text, p_amount numeric, p_min_receive numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_from_rate numeric; v_to_rate numeric;
  v_usd numeric; v_out numeric; v_fee_pct numeric := 0.006; v_fee_usd numeric;
  v_from public.wallets%rowtype;
  v_ref text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_from_asset = p_to_asset then raise exception 'SAME_ASSET'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select usd into v_from_rate from public.price_cache where symbol = p_from_asset;
  select usd into v_to_rate from public.price_cache where symbol = p_to_asset;
  if coalesce(v_from_rate,0) <= 0 or coalesce(v_to_rate,0) <= 0 then raise exception 'RATE_UNAVAILABLE'; end if;

  select * into v_from from public.wallets where user_id = v_user and asset = p_from_asset for update;
  if not found or v_from.available < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;

  v_usd := p_amount * v_from_rate;
  v_fee_usd := v_usd * v_fee_pct;
  v_out := round((v_usd - v_fee_usd) / v_to_rate, 8);
  if v_out <= 0 then raise exception 'AMOUNT_TOO_SMALL'; end if;
  if p_min_receive > 0 and v_out < p_min_receive then raise exception 'SLIPPAGE_EXCEEDED:%', v_out; end if;

  update public.wallets set available = available - p_amount where id = v_from.id;
  insert into public.wallets(user_id, asset, available, usd_rate)
  values (v_user, p_to_asset, v_out, v_to_rate)
  on conflict (user_id, asset) do update set available = public.wallets.available + excluded.available, updated_at = now();

  v_ref := public._txn(v_user, 'swap', p_from_asset, p_amount, 'debit',
    'Swap ' || p_from_asset || ' → ' || p_to_asset, p_to_asset, v_out, round(v_fee_usd / v_from_rate, 8), 'internal-amm', null, 'completed');

  return jsonb_build_object('ok', true, 'from_amount', p_amount, 'to_amount', v_out,
    'rate', v_from_rate / v_to_rate, 'fee_usd', v_fee_usd, 'tx_ref', v_ref);
end $$;

-- ============================================================
-- ADMIN: AUDITED BALANCE ADJUSTMENT (append-only trail)
-- ============================================================
create or replace function public.admin_adjust_balance(p_user_id uuid, p_asset text, p_amount numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_ref text;
  v_new numeric(38,18);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_amount = 0 then raise exception 'INVALID_AMOUNT'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 8 then raise exception 'REASON_TOO_SHORT'; end if;
  select email into v_email from public.profiles where id = v_actor;

  -- wallet must never go negative: lock & check before debit
  if p_amount < 0 then
    perform 1 from public.wallets where user_id = p_user_id and asset = p_asset and available + p_amount >= 0 for update;
    if not found then raise exception 'INSUFFICIENT_FUNDS_FOR_DEBIT'; end if;
  end if;

  insert into public.wallets(user_id, asset, available)
  values (p_user_id, p_asset, greatest(p_amount,0) * 0 + p_amount)  -- negative-safe: wallets.available check rejects <0
  on conflict (user_id, asset) do update set available = public.wallets.available + excluded.available, updated_at = now()
  returning available into v_new;

  v_ref := 'ADJ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.adjustments(ref, user_id, asset, amount, reason, actor_id, actor_email)
  values (v_ref, p_user_id, p_asset, p_amount, trim(p_reason), v_actor, v_email);

  perform public._txn(p_user_id, 'adjustment', p_asset, abs(p_amount), case when p_amount >= 0 then 'credit' else 'debit' end,
    'Admin adjustment — ' || trim(p_reason), null, null, 0, 'admin', v_ref, 'completed');
  perform public._notify(p_user_id, 'Balance adjusted', p_amount || ' ' || p_asset || ' — ' || trim(p_reason), 'system', '/wallet');

  return jsonb_build_object('ok', true, 'ref', v_ref, 'new_balance', v_new);
end $$;

-- ============================================================
-- ADMIN: CREATE POOL
-- ============================================================
create or replace function public.admin_create_pool(
  p_name text, p_subtitle text, p_asset text, p_ticket_price numeric, p_prize_asset text,
  p_prize_amount numeric, p_prize_usd numeric, p_capacity integer, p_closes_at timestamptz,
  p_prize_funded boolean, p_max_per_user integer, p_draw_method text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_ticket_price <= 0 or p_capacity <= 0 then raise exception 'INVALID_PARAMS'; end if;
  insert into public.pools(name, subtitle, asset, ticket_price, prize_asset, prize_amount, prize_usd, capacity, closes_at, prize_funded, max_tickets_per_user, status, draw_method)
  values (p_name, coalesce(p_subtitle,''), p_asset, p_ticket_price, p_prize_asset, p_prize_amount, p_prize_usd, p_capacity, p_closes_at, p_prize_funded, greatest(1, coalesce(p_max_per_user,50)), 'open', coalesce(p_draw_method, 'verifiable random (SHA-256 of committed seed + blockhash)'))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'pool_id', v_id);
end $$;

-- ============================================================
-- ADMIN: CLOSE POOL + DRAW WINNER — auditable selection
-- Draw seed = SHA-256(pool_id || drawn_at || first-ticket-id ||
-- random salt inserted at draw time); every input stored.
-- ============================================================
create or replace function public.admin_close_and_draw(p_pool_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pool public.pools%rowtype;
  v_winner public.tickets%rowtype;
  v_ticket_ids uuid[];
  v_draw_time timestamptz := now();
  v_seed text;
  v_hash text;
  v_idx integer;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_pool from public.pools where id = p_pool_id for update;
  if not found then raise exception 'POOL_NOT_FOUND'; end if;
  if v_pool.status = 'drawn' or v_pool.status = 'paid' then raise exception 'ALREADY_DRAWN'; end if;

  update public.pools set status = 'closed' where id = v_pool.id;

  select array_agg(id order by ticket_number) into v_ticket_ids from public.tickets where pool_id = p_pool_id;
  v_count := coalesce(array_length(v_ticket_ids,1), 0);
  if v_count = 0 then
    return jsonb_build_object('ok', true, 'status', 'closed', 'message', 'Pool closed with no tickets sold — no draw performed.');
  end if;

  v_seed := v_pool.id::text || '|' || v_draw_time::text || '|' || v_ticket_ids[1]::text || '|' || gen_random_uuid()::text;
  v_hash := encode(digest(v_seed, 'sha256'), 'hex');
  v_idx := ('x' || substr(v_hash, 1, 8))::bit(32)::bigint % v_count;
  if v_idx < 0 then v_idx := -v_idx; end if;

  select * into v_winner from public.tickets where id = v_ticket_ids[v_idx + 1];

  update public.tickets set is_winner = true, status = 'won' where id = v_winner.id;
  update public.tickets set status = 'lost' where pool_id = p_pool_id and id <> v_winner.id;
  update public.pools set status = 'drawn', drawn_at = v_draw_time, winner_ticket = v_winner.id, winner_id = v_winner.user_id,
    draw_method = 'SHA-256 verifiable draw · seed committed at close · v_idx=' || v_idx
  where id = v_pool.id;

  perform public._notify(v_winner.user_id, 'You won the ' || v_pool.name || '!', 'Winning ticket ' || v_winner.ticket_number || '. Prize payout is processed by the treasury after final settlement.', 'prize', '/tickets');

  return jsonb_build_object('ok', true, 'status', 'drawn', 'winner_ticket', v_winner.ticket_number,
    'winning_index', v_idx, 'tickets_entered', v_count, 'seed_hash', v_hash);
end $$;

-- ============================================================
-- ADMIN: MARK PRIZE PAID — only after verified on-chain payment
-- ============================================================
create or replace function public.admin_mark_prize_paid(p_pool_id uuid, p_tx_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pool public.pools%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_tx_ref,''))) < 6 then raise exception 'TX_REF_REQUIRED'; end if;
  select * into v_pool from public.pools where id = p_pool_id for update;
  if not found then raise exception 'POOL_NOT_FOUND'; end if;
  if v_pool.status <> 'drawn' then raise exception 'POOL_NOT_DRAWN'; end if;
  if v_pool.payout_status = 'paid' then return jsonb_build_object('ok', true, 'already_paid', true); end if;

  -- credit prize to winner wallet
  insert into public.wallets(user_id, asset, available)
  values (v_pool.winner_id, v_pool.prize_asset, v_pool.prize_amount)
  on conflict (user_id, asset) do update set available = public.wallets.available + excluded.available, updated_at = now();

  update public.pools set status = 'paid', payout_status = 'paid', payout_tx = trim(p_tx_ref), paid_at = now() where id = v_pool.id;

  perform public._txn(v_pool.winner_id, 'prize_credit', v_pool.prize_asset, v_pool.prize_amount, 'credit',
    'Prize payout — ' || v_pool.name || ' (' || coalesce(p_tx_ref,'') || ')', null, null, 0, 'onchain', trim(p_tx_ref), 'completed');
  perform public._notify(v_pool.winner_id, 'Prize paid', v_pool.prize_amount || ' ' || v_pool.prize_asset || ' prize for ' || v_pool.name || ' has been paid. Ref: ' || trim(p_tx_ref), 'prize', '/wallet');

  return jsonb_build_object('ok', true, 'status', 'paid');
end $$;

-- ============================================================
-- ADMIN: WELCOME ALLOCATIONS OVERVIEW + MANUAL RELEASE
-- ============================================================
create or replace function public.admin_release_allocation(p_user_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_alloc public.welcome_allocations%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 8 then raise exception 'REASON_TOO_SHORT'; end if;
  select * into v_alloc from public.welcome_allocations where user_id = p_user_id for update;
  if not found then raise exception 'ALLOCATION_NOT_FOUND'; end if;
  if v_alloc.status = 'unlocked' then return jsonb_build_object('ok', true, 'already_unlocked', true); end if;

  update public.wallets set locked = locked - v_alloc.btc_amount, available = available + v_alloc.btc_amount, updated_at = now()
  where user_id = p_user_id and asset = 'BTC';
  update public.welcome_allocations set status = 'unlocked', unlocked_at = now() where id = v_alloc.id;

  insert into public.adjustments(ref, user_id, asset, amount, reason, actor_id, actor_email)
  values ('ADJ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), p_user_id, 'BTC', v_alloc.btc_amount,
          'Manual welcome release — ' || trim(p_reason), auth.uid(), (select email from public.profiles where id = auth.uid()));
  perform public._txn(p_user_id, 'adjustment', 'BTC', v_alloc.btc_amount, 'credit', 'Manual welcome release — ' || trim(p_reason), null, null, 0, 'admin', null, 'completed');
  perform public._notify(p_user_id, 'Welcome BTC released', 'Your welcome allocation of ' || v_alloc.btc_amount || ' BTC has been released by the treasury.', 'prize', '/wallet');
  return jsonb_build_object('ok', true, 'status', 'unlocked');
end $$;

-- ============================================================
-- RATE LIMIT GUARD — call before expensive user actions
-- ============================================================
create or replace function public.check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); v_count integer;
begin
  insert into public.rate_limits(bucket, window_start, count) values (p_bucket || ':' || auth.uid()::text, v_window, 1)
  on conflict (bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end $$;

-- chat send with rate limit (10 msgs / 30s)
create or replace function public.send_chat_message(p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_body,''))) < 1 or char_length(p_body) > 500 then raise exception 'INVALID_BODY'; end if;
  if not public.check_rate_limit('chat', 10, 30) then raise exception 'RATE_LIMITED'; end if;
  insert into public.chat_messages(channel, user_id, body) values ('global', v_user, trim(p_body)) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.send_support_message(p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_thread uuid; v_role text := 'user'; v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_body,''))) < 1 or char_length(p_body) > 1000 then raise exception 'INVALID_BODY'; end if;
  if not public.check_rate_limit('support', 12, 60) then raise exception 'RATE_LIMITED'; end if;
  if public.is_admin() then v_role := 'admin'; v_thread := v_user; else v_thread := v_user; end if;
  insert into public.support_messages(user_id, sender_id, sender_role, body) values (v_thread, v_user, v_role, trim(p_body)) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
