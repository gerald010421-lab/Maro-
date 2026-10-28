import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, friendlyError } from './supabase';
import type { Profile, PricePoint } from './types';

/* ================= TOASTS ================= */
export type ToastKind = 'success' | 'error' | 'info' | 'gold';
export interface Toast { id: number; kind: ToastKind; title: string; body?: string }
interface ToastCtx { toasts: Toast[]; push: (kind: ToastKind, title: string, body?: string) => void; dismiss: (id: number) => void }
const ToastContext = createContext<ToastCtx | null>(null);
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside provider');
  return ctx;
}

/* ================= AUTH ================= */
interface AuthCtx {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx | null>(null);
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}

/* ================= PRICES (CoinGecko live oracle → price_cache) ================= */
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin',
  BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin',
};
export interface PriceMap { [symbol: string]: { usd: number; change24h: number } }
interface PricesCtx { prices: PriceMap; lastUpdated: Date | null; live: boolean; error: string | null; refresh: () => Promise<void> }
const PricesContext = createContext<PricesCtx | null>(null);
export function usePrices() {
  const ctx = useContext(PricesContext);
  if (!ctx) throw new Error('usePrices outside provider');
  return ctx;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ---------- auth ---------- */
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(async (uid: string) => {
    if (!supabase) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    return (data as Profile | null) ?? null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  }, [session?.user, fetchProfile]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).then((p) => { if (!cancelled) { setProfile(p); setLoading(false); } });
      } else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        fetchProfile(sess.user.id).then((p) => setProfile(p));
      } else setProfile(null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null);
  }, []);

  const isAdmin = !!profile && profile.role === 'admin' &&
    (profile.email ?? '').toLowerCase() === 'christianmark474@gmail.com';

  /* ---------- prices ---------- */
  const [prices, setPrices] = useState<PriceMap>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // DB snapshot first (works offline / rate-limited), then live oracle refresh
    if (supabase) {
      try {
        const { data } = await supabase.from('price_cache').select('*');
        if (data && data.length) {
          const map: PriceMap = {};
          (data as PricePoint[]).forEach((r) => { map[r.symbol] = { usd: Number(r.usd), change24h: Number(r.change_24h) }; });
          setPrices((prev) => ({ ...map, ...prev }));
        }
      } catch { /* snapshot optional */ }
    }
    try {
      const ids = Object.values(COINGECKO_IDS).join(',');
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) throw new Error(`price oracle ${res.status}`);
      const json = await res.json() as Record<string, { usd: number; usd_24h_change?: number }>;
      const map: PriceMap = {};
      for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
        const row = json[id];
        if (row?.usd) map[sym] = { usd: row.usd, change24h: row.usd_24h_change ?? 0 };
      }
      if (Object.keys(map).length) {
        setPrices((prev) => ({ ...prev, ...map }));
        setLastUpdated(new Date());
        setLive(true);
        setPriceError(null);
        // persist snapshot back so the DB oracle (used by claim_welcome_allocation) stays fresh
        if (supabase) {
          const rows = Object.entries(map).map(([symbol, v]) => ({ symbol, usd: v.usd, change_24h: v.change24h, updated_at: new Date().toISOString() }));
          supabase.from('price_cache').upsert(rows, { onConflict: 'symbol' }).then(() => undefined);
        }
      }
    } catch (e) {
      setLive(false);
      setPriceError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 60000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const toastCtx = useMemo<ToastCtx>(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  const authCtx = useMemo<AuthCtx>(
    () => ({ configured: isSupabaseConfigured, loading, session, userId: session?.user?.id ?? null, profile, isAdmin, refreshProfile, signOut }),
    [loading, session, profile, isAdmin, refreshProfile, signOut],
  );
  const pricesCtx = useMemo<PricesCtx>(() => ({ prices, lastUpdated, live, error: priceError, refresh }), [prices, lastUpdated, live, priceError, refresh]);

  return (
    <ToastContext.Provider value={toastCtx}>
      <AuthContext.Provider value={authCtx}>
        <PricesContext.Provider value={pricesCtx}>
          {children}
        </PricesContext.Provider>
      </AuthContext.Provider>
    </ToastContext.Provider>
  );
}
