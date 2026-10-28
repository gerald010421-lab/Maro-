-- ============================================================
-- DIGITAL COIN LOTTERY — 0003 ROW LEVEL SECURITY
-- Users can read only their own private rows; public content
-- (pools, announcements, chat, price cache) is world-readable
-- to authenticated members; all financial writes go through
-- SECURITY DEFINER functions (0002), never direct table writes.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.wallets enable row level security;
alter table public.pools enable row level security;
alter table public.tickets enable row level security;
alter table public.transactions enable row level security;
alter table public.adjustments enable row level security;
alter table public.welcome_allocations enable row level security;
alter table public.platform_addresses enable row level security;
alter table public.deposits enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_messages enable row level security;
alter table public.support_messages enable row level security;
alter table public.price_cache enable row level security;
alter table public.rate_limits enable row level security;
alter table public.purchase_requests enable row level security;

-- purchase requests: owner + admin read; writes happen inside purchase_tickets() only
drop policy if exists "purchase_requests_read_own" on public.purchase_requests;
create policy "purchase_requests_read_own" on public.purchase_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- PROFILES ----------
drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Privilege escalation blocked by COLUMN-LEVEL grants (avoids RLS self-recursion):
-- authenticated may update only cosmetic columns — never role/email/id.
revoke update on public.profiles from authenticated;
grant update (username, full_name, avatar_color) on public.profiles to authenticated;

-- ---------- ASSETS (readable by all members, writable by admin only) ----------
drop policy if exists "assets_read" on public.assets;
create policy "assets_read" on public.assets for select to authenticated using (true);
drop policy if exists "assets_admin_write" on public.assets;
create policy "assets_admin_write" on public.assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- WALLETS ----------
drop policy if exists "wallets_read_own" on public.wallets;
create policy "wallets_read_own" on public.wallets for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- no direct insert/update/delete policies: all mutations via SECURITY DEFINER functions

-- ---------- POOLS ----------
drop policy if exists "pools_read" on public.pools;
create policy "pools_read" on public.pools for select to authenticated using (true);
drop policy if exists "pools_admin_write" on public.pools;
create policy "pools_admin_write" on public.pools for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- TICKETS ----------
drop policy if exists "tickets_read_own" on public.tickets;
create policy "tickets_read_own" on public.tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- public, anonymised recent entries for the ticker (masked identity)
create or replace view public.recent_entries as
  select t.id, t.created_at, t.ticket_number, p.name as pool_name, p.prize_usd,
         'Member •••' || upper(substr(t.user_id::text, 1, 2)) || substr(t.user_id::text, length(t.user_id::text) - 1) as masked_member
  from public.tickets t join public.pools p on p.id = t.pool_id
  order by t.created_at desc limit 30;
grant select on public.recent_entries to authenticated;

-- ---------- TRANSACTIONS ----------
drop policy if exists "transactions_read_own" on public.transactions;
create policy "transactions_read_own" on public.transactions for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- ADJUSTMENTS (audit trail: admin-readable, admin-insertable via functions only) ----------
drop policy if exists "adjustments_admin_read" on public.adjustments;
create policy "adjustments_admin_read" on public.adjustments for select to authenticated using (public.is_admin());

-- ---------- WELCOME ALLOCATIONS ----------
drop policy if exists "welcome_read_own" on public.welcome_allocations;
create policy "welcome_read_own" on public.welcome_allocations for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- PLATFORM ADDRESSES (everyone reads active ones; admin manages all) ----------
drop policy if exists "addresses_read_active" on public.platform_addresses;
create policy "addresses_read_active" on public.platform_addresses for select to authenticated
  using (status = 'active' or public.is_admin());
drop policy if exists "addresses_admin_write" on public.platform_addresses;
create policy "addresses_admin_write" on public.platform_addresses for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- DEPOSITS ----------
drop policy if exists "deposits_read_own" on public.deposits;
create policy "deposits_read_own" on public.deposits for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- ANNOUNCEMENTS ----------
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements for select to authenticated using (true);
drop policy if exists "announcements_admin_write" on public.announcements;
create policy "announcements_admin_write" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- NOTIFICATIONS ----------
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications_update_own_read" on public.notifications;
create policy "notifications_update_own_read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------- CHAT (global lounge: members read/send, admin moderate) ----------
drop policy if exists "chat_read" on public.chat_messages;
create policy "chat_read" on public.chat_messages for select to authenticated using (is_deleted = false);
drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own" on public.chat_messages for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "chat_admin_update" on public.chat_messages;
create policy "chat_admin_update" on public.chat_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- SUPPORT (strict thread isolation: user sees own thread; admin sees all) ----------
drop policy if exists "support_read_own_or_admin" on public.support_messages;
create policy "support_read_own_or_admin" on public.support_messages for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "support_insert_own" on public.support_messages;
create policy "support_insert_own" on public.support_messages for insert to authenticated
  with check ((sender_id = auth.uid()) and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "support_admin_update" on public.support_messages;
create policy "support_admin_update" on public.support_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- PRICE CACHE ----------
drop policy if exists "prices_read" on public.price_cache;
create policy "prices_read" on public.price_cache for select to authenticated using (true);
drop policy if exists "prices_admin_write" on public.price_cache;
create policy "prices_admin_write" on public.price_cache for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- RATE LIMITS (no direct access; only via functions) ----------
-- (no policies = deny all direct access)

-- enable realtime broadcast for live tables
do $$
begin
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.support_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.platform_addresses; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pools; exception when duplicate_object then null; end;
end $$;
