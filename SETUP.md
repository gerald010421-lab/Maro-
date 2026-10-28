# DIGITAL COIN LOTTERY — Operations & Deployment Guide

Black-and-gold crypto lottery + multi-asset custodial wallet. React 19 · Vite · TypeScript · Tailwind v4 · Supabase (Auth · Postgres · Realtime · RLS) · HashRouter on Vercel.

## 1. Architecture

```
Browser (React SPA)                Supabase Cloud
┌──────────────────────┐          ┌──────────────────────────────┐
│ Landing / App / Admin│  HTTPS   │ Auth (email + Google OAuth)  │
│ supabase-js client   │ ───────► │ Postgres + RLS               │
│ anon key (public)    │          │ SECURITY DEFINER RPCs        │
└──────────────────────┘          │ Realtime channels            │
                                  └──────────────────────────────┘
```

Authorization is enforced **inside Postgres** (row locks, checks, SECURITY DEFINER functions, RLS). The browser can *request*; it can never dictate. The designated admin — `Christianmark474@gmail.com` — is matched by a server-side `is_admin()` that requires `profiles.role='admin' AND email matches`. The role is assigned by an `auth.users` trigger at signup; there is no client-side path to escalate.

## 2. Database migrations (applied in order)

| File | Contents |
|---|---|
| `0001_init.sql` | Tables (profiles, assets, wallets, pools, tickets, purchase_requests, transactions, adjustments, welcome_allocations, platform_addresses, deposits, announcements, notifications, chat_messages, support_messages, price_cache, rate_limits), indexes, `is_admin()`, new-user bootstrap trigger creating 8 asset wallets |
| `0002_functions.sql` | `purchase_tickets` (row-lock, no-oversell, idempotent via purchase_requests), `claim_welcome_allocation` ($80,000 → BTC at treasury rate, locked), `_maybe_unlock_welcome` (auto-unlock on verified qualifying deposit), `record_deposit`, `admin_credit_deposit` (exactly-once crediting), `internal_transfer`, `execute_swap` (0.6% fee, slippage floor, atomic), `admin_adjust_balance` (append-only audit), `admin_create_pool`, `admin_close_and_draw` (SHA-256 verifiable seed), `admin_mark_prize_paid`, `admin_release_allocation`, `check_rate_limit`, `send_chat_message`, `send_support_message` |
| `0003_rls.sql` | Row-Level Security for every table; column-restricted `profiles` update (role can never be self-edited); realtime publication |
| `0004_seed.sql` | 8 assets, price-cache bootstrap, two flagship pools |
| `0005_admin_reply.sql` | `admin_reply_support` |
| `0006_withdrawals.sql` | `request_external_withdrawal` (atomic hold + queue), `admin_finalize_withdrawal` (approve with tx hash → complete; reject → auto-refund + audit row), `support_mark_read`, chat/notification policy hygiene |

Apply: `supabase link --project-ref <ref> && supabase db push`
or paste each file into the SQL Editor in order.

**Admin account:** the admin registers normally with `Christianmark474@gmail.com`; the trigger stamps `role='admin'`. Verified live against PostgreSQL 17 in this repo (see "Verification status" below).

## 3. Environment

Copy `.env.example` → `.env.local` (dev) and into Vercel env vars (prod):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required
- `VITE_GOOGLE_OAUTH_ENABLED=true` — after enabling Google provider (below)
- `VITE_WELCOME_PROGRAM_ENABLED` — kill-switch for the $80k programme UI

**Google OAuth:** Supabase Dashboard → Authentication → Providers → Google → paste Client ID/Secret from Google Cloud Console (authorized redirect: `https://<project>.supabase.co/auth/v1/callback`). No keys live in this repo.

## 4. $80,000 Welcome Programme — funding & conversion

- One allocation per account, issued once by `claim_welcome_allocation()` on first sign-in. Unique constraint on `welcome_allocations.user_id` + `already_claimed` replay = exactly-once.
- Allocation = $80,000 − $25 funding/conversion fee → BTC at the **treasury oracle rate** (`price_cache`, refreshed live from CoinGecko by every client; admin-overridable). BTC credited to the member's **locked** bucket and a `welcome_conversion` ledger row written with the rate, fee, BTC amount and unique `conversion_ref`.
- Locked BTC can only leave the bucket through `_maybe_unlock_welcome()`, which runs inside `admin_credit_deposit()` when a deposit (a) is credited by treasury and (b) its USD value ≥ $500 (the configured `unlock_requirement_usd`). Unlock moves locked→available atomically and notifies the member. It never trusts screenshots or user-claimed hashes — only treasury-verified deposits.
- Admins may manually release via `admin_release_allocation(reason≥8)` — written as an audited adjustment with actor email.
- **Funding source:** the programme is a treasury-funded payable liability, recorded per-member in `welcome_allocations` + `transactions`. For production, hold the converted BTC in a treasury wallet (Turnkey/Fireblocks) and reconcile `locked BTC` outstanding against treasury holdings weekly. Set `VITE_WELCOME_PROGRAM_ENABLED=false` to pause.

## 5. Wallets & deposits

Custody model is treasury-custodial (Turnkey/Fireblocks/Fireblocks-style WaaS ready). The app never fabricates addresses and never requests keys.

- **Official payment addresses** are admin-broadcast from `/admin` → Payment Addresses & Broadcasts. Create/edit/replace/deactivate with mandatory asset/network/address confirmation. Broadcast via Supabase realtime to every member's Wallet → Official Payment Addresses tab, with exact copy-to-clipboard buttons. Copying never credits anything.
- **Deposits:** member submits amount + tx hash → `pending`. Treasury verifies on-chain (explorer links embedded) → `admin_credit_deposit()` credits exactly once (idempotent; same hash can't double-credit) and auto-runs the welcome-unlock review.
- **Send:** member-to-member is instant via `internal_transfer` (row-locked). External addresses are network-validated, held in an atomic debit, and queued for treasury signing; approve/reject from the Authorization Desk — rejection auto-refunds with an audit adjustment.
- **Swap:** `execute_swap` at oracle rates − 0.6% fee with `min_receive` slippage floor, fully atomic and revert-on-slippage. BTC↔ETH↔USDT+ supported. Never quotes fabricated numbers: display rates come from CoinGecko/price_cache; execution uses the DB-cached snapshot.
- Withdrawals ≠ deposits: external sends are recorded as queued `withdrawal` transactions — the treasury signer is the only path that moves funds on-chain. Wire the signing provider as a server-side Supabase Edge Function consuming the queue (never in-browser).

## 6. Admin console (`/admin`, `is_admin()`-gated)

Overview · Members & Balances (search, expand, adjust) · Deposit Verification + Withdrawal queue · Pools & Draws (create, close & draw, mark paid with on-chain ref, funding badge) · Payment Addresses & Broadcasts · Announcements · Welcome Allocations (manual release) · Audit Ledger (transactions + adjustments, CSV export) · Assets & Rates · Support Inbox.

## 7. Testing & verification status (this build)

Verified against embedded **PostgreSQL 17** in CI-style harness (`/tmp/run_pg.mjs`):
- ✅ All 6 migrations apply cleanly; all tables/indexes/triggers/functions create
- ✅ New-user trigger: profile + 8 asset wallets bootstrap; admin trigger stamps role for the designated admin email
- ✅ Welcome claim: $80,000 → 0.82093 BTC @ $97,420 recorded with ref; second claim is a no-op replay
- ✅ Locked BTC not spendable (INSUFFICIENT_FUNDS on purchase with empty available)
- ✅ Ticket purchase: balance-checked, atomic debit, ticket issuance; replay with same idempotency key returns original tickets without double charge
- ✅ SHA-256 verifiable draw executed: winning index 1 of 2 tickets, seed hash recorded
- ✅ chat RPC works; rate limits enforced in DB

Requires live credentials (cannot be machine-verified without them):
- ⚠️ Google OAuth round-trip — wire client ID/secret in Supabase dashboard
- ⚠️ Real on-chain deposit verification & external signing — currently treasury-manual by design; automated provider webhooks planned (server-side Edge Function with signed webhook verification; schema already stores provider_ref)
- ⚠️ CoinGecko price feed availability from the deployed domain

## 8. Security properties

RLS on every table; SECURITY DEFINER RPCs with `search_path=public`; row-level `FOR UPDATE` locks on pools and wallets; append-only `adjustments`; unique idempotency keys; column-restricted profile updates; no seeds/keys stored client-side; private support threads isolated by RLS (user sees own thread only; admin via `admin_reply_support`/`support_mark_read`).

## 9. Deploy

1. `supabase db push` (migrations above)
2. Vercel env vars from `.env.example` → redeploy
3. Register with `Christianmark474@gmail.com` → confirm email → /admin
4. Publish an official address; deposit; verify; watch unlock fire
