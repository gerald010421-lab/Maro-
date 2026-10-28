-- ============================================================
-- DIGITAL COIN LOTTERY — 0006 WITHDRAWALS + POLICY HYGIENE
-- ============================================================

-- ---------- EXTERNAL WITHDRAWAL — atomic hold, treasury signer ----------
create or replace function public.request_external_withdrawal(
  p_asset text, p_network text, p_address text, p_amount numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_asset public.assets%rowtype;
  v_fee numeric(38,18);
  v_total numeric(38,18);
  v_ref text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if char_length(trim(coalesce(p_address,''))) < 12 then raise exception 'INVALID_ADDRESS'; end if;

  select * into v_asset from public.assets where symbol = p_asset and is_enabled;
  if not found then raise exception 'ASSET_DISABLED'; end if;
  v_fee := coalesce(v_asset.withdraw_fee, 0);
  v_total := p_amount + v_fee;
  if p_amount < v_asset.min_withdraw then raise exception 'BELOW_MIN_WITHDRAW:%', v_asset.min_withdraw; end if;

  select * into v_wallet from public.wallets where user_id = v_user and asset = p_asset for update;
  if not found or v_wallet.available < v_total then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update public.wallets set available = available - v_total where id = v_wallet.id;

  v_ref := 'WD-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.transactions(ref, user_id, type, asset, amount, fee, direction, status, provider, note)
  values (v_ref, v_user, 'withdrawal', p_asset, p_amount, v_fee, 'debit', 'pending', 'treasury-signer',
          'External withdrawal to ' || trim(p_address) || ' (' || p_network || ') — queued for treasury signing');

  perform public._notify(v_user, 'Withdrawal queued', p_amount || ' ' || p_asset || ' to ' || left(trim(p_address), 14) || '… — the treasury signer processes external payouts after review.', 'info', '/wallet?tab=activity');
  return jsonb_build_object('ok', true, 'ref', v_ref, 'total_debit', v_total, 'fee', v_fee);
end $$;

-- ---------- ADMIN: FINALIZE OR REJECT A QUEUED WITHDRAWAL ----------
create or replace function public.admin_finalize_withdrawal(p_ref text, p_approve boolean, p_tx_hash text default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_tx public.transactions%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_tx from public.transactions where ref = p_ref and type = 'withdrawal' for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_tx.status <> 'pending' then return jsonb_build_object('ok', true, 'already_final', true, 'status', v_tx.status); end if;

  if p_approve then
    if char_length(trim(coalesce(p_tx_hash,''))) < 6 then raise exception 'TX_HASH_REQUIRED'; end if;
    update public.transactions set status = 'completed', provider_ref = trim(p_tx_hash),
      note = note || ' — signed & broadcast by treasury' where ref = p_ref;
    perform public._notify(v_tx.user_id, 'Withdrawal completed', v_tx.amount || ' ' || v_tx.asset || ' sent on-chain. Tx: ' || trim(p_tx_hash), 'success', '/wallet?tab=activity');
    return jsonb_build_object('ok', true, 'status', 'completed');
  else
    if char_length(trim(coalesce(p_reason,''))) < 8 then raise exception 'REASON_TOO_SHORT'; end if;
    -- refund amount + fee
    update public.wallets set available = available + v_tx.amount + v_tx.fee, updated_at = now()
      where user_id = v_tx.user_id and asset = v_tx.asset;
    update public.transactions set status = 'failed', note = note || ' — REJECTED & refunded: ' || trim(p_reason) where ref = p_ref;
    insert into public.adjustments(ref, user_id, asset, amount, reason, actor_id, actor_email)
    values ('ADJ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), v_tx.user_id, v_tx.asset, (v_tx.amount + v_tx.fee),
            'Withdrawal rejected — refund: ' || trim(p_reason), v_actor, (select email from public.profiles where id = v_actor));
    perform public._notify(v_tx.user_id, 'Withdrawal rejected & refunded', v_tx.amount || ' ' || v_tx.asset || ' returned to your wallet. Reason: ' || trim(p_reason), 'warning', '/wallet?tab=activity');
    return jsonb_build_object('ok', true, 'status', 'rejected_refunded');
  end if;
end $$;

-- ---------- SUPPORT MARK-READ (thread-owner scoped, both sides) ----------
create or replace function public.support_mark_read(p_thread_owner uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_self uuid := auth.uid(); v_owner uuid; v_count integer;
begin
  if v_self is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.is_admin() then
    v_owner := coalesce(p_thread_owner, v_self);
    update public.support_messages set is_read = true where user_id = v_owner and sender_role = 'user' and not is_read;
    get diagnostics v_count = row_count;
  else
    v_owner := v_self;  -- members can only mark their own thread
    update public.support_messages set is_read = true where user_id = v_owner and sender_role = 'admin' and not is_read;
    get diagnostics v_count = row_count;
  end if;
  return jsonb_build_object('ok', true, 'marked', coalesce(v_count, 0));
end $$;

-- ============================================================
-- POLICY HYGIENE
-- ============================================================

-- chat goes exclusively through send_chat_message (rate-limited RPC)
drop policy if exists "chat_insert_own" on public.chat_messages;

-- notifications: only is_read may change, and only by the owner
drop policy if exists "notifications_update_own_read" on public.notifications;
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
create policy "notifications_update_own_read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- support messages: mark-read flows through support_mark_read() only
drop policy if exists "support_admin_update" on public.support_messages;
revoke update on public.support_messages from authenticated;
