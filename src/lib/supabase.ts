import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(url) && anonKey.length > 20;

export const ADMIN_EMAIL = 'christianmark474@gmail.com';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'dcl-auth',
      },
      realtime: { params: { eventsPerSecond: 12 } },
    })
  : null;

export function getClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** Crisp, actionable copy for Postgres/PostgREST/Auth errors. Never raw SQL. */
export function friendlyError(err: unknown): string {
  const raw =
    (err as { message?: string })?.message ??
    (err as { error_description?: string })?.error_description ??
    String(err ?? '');
  const p = (re: RegExp): string | null => {
    const m = raw.match(re);
    return m ? m[1] ?? '' : null;
  };
  let v: string | null;
  if ((v = p(/INSUFFICIENT_FUNDS:([\d.]+)/i)) !== null) return `Insufficient available balance — you have ${v} available. Locked welcome funds cannot be spent.`;
  if (/INSUFFICIENT_FUNDS/i.test(raw)) return 'Insufficient available balance. Locked welcome funds cannot be spent.';
  if ((v = p(/NOT_ENOUGH_CAPACITY:(\d+)/i)) !== null) return `Only ${v} ticket(s) remain in this pool — reduce quantity.`;
  if ((v = p(/PER_USER_LIMIT:(\d+)/i)) !== null) return `Per-member limit is ${v} tickets for this pool.`;
  if ((v = p(/INSUFFICIENT_CONFIRMATIONS:(\d+)/i)) !== null) return `Requires at least ${v} confirmations before crediting.`;
  if ((v = p(/SLIPPAGE_EXCEEDED:([\d.]+)/i)) !== null) return `Price moved beyond your slippage tolerance. Quoted output: ${v}.`;
  if (/POOL_NOT_OPEN|POOL_NOT_FOUND|ALREADY_DRAWN/i.test(raw)) return 'That pool is no longer open or has already been drawn.';
  if (/POOL_CLOSED/i.test(raw)) return 'This pool closed before your purchase completed.';
  if (/AUTH_REQUIRED/i.test(raw)) return 'Please sign in to continue.';
  if (/ADMIN_REQUIRED/i.test(raw)) return 'This action is restricted to the treasury administrator.';
  if (/INVALID_QUANTITY/i.test(raw)) return 'Enter a valid ticket quantity (1–100).';
  if (/RECIPIENT_NOT_FOUND/i.test(raw)) return 'No member matches that username or email.';
  if (/CANNOT_SEND_TO_SELF/i.test(raw)) return 'You cannot transfer to your own account.';
  if (/DUPLICATE_TX_HASH/i.test(raw)) return 'That transaction hash has already been submitted.';
  if (/INVALID_TX_HASH/i.test(raw)) return 'Enter a valid on-chain transaction hash (min 12 characters).';
  if (/REASON_TOO_SHORT/i.test(raw)) return 'Provide a reason of at least 8 characters for the audit trail.';
  if (/RATE_LIMITED/i.test(raw)) return 'Slow down — you are sending messages too quickly.';
  if (/INVALID_BODY/i.test(raw)) return 'Message body is empty or too long.';
  if (/RATE_UNAVAILABLE|BTC_RATE_UNAVAILABLE/i.test(raw)) return 'Live rate unavailable right now. Try again in a moment.';
  if (/SAME_ASSET/i.test(raw)) return 'Choose two different assets to swap.';
  if (/INVALID_AMOUNT/i.test(raw)) return 'Enter a valid positive amount.';
  if (/AMOUNT_TOO_SMALL/i.test(raw)) return 'Amount too small to swap after fees.';
  if (/duplicate key/i.test(raw)) return 'That record already exists.';
  if (/Invalid login credentials/i.test(raw)) return 'Incorrect email or password.';
  if (/Email not confirmed/i.test(raw)) return 'Verify your email first — check your inbox for the confirmation link.';
  if (/User already registered/i.test(raw)) return 'An account with this email already exists. Sign in instead.';
  if (/Password should be/i.test(raw)) return 'Password must be at least 6 characters.';
  return raw.replace(/^.*?:\s*/, '').slice(0, 220) || 'Something went wrong. Please try again.';
}
