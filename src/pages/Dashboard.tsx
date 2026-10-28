import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet as WalletIcon, Ticket, TrendingUp, ArrowDownLeft, ArrowUpRight, Megaphone, Sparkles,
  ChevronRight, Lock, Trophy, Coins, BadgeCheck, ArrowLeftRight, ShieldCheck, Pin,
} from 'lucide-react';
import { useAuth, usePrices, useToast } from '../lib/context';
import { getClient, friendlyError } from '../lib/supabase';
import type { Wallet, Pool, WelcomeAllocation, Announcement, Transaction, RecentEntry, Ticket as TicketRow } from '../lib/types';
import { fmtCrypto, fmtUsd, timeAgo, timeLeft } from '../lib/format';
import { Card, CardSkeleton, DCLButton, CoinMark, ProgressBar } from '../components/ui';
import { AssetIcon } from '../lib/cryptoAssets';

export default function Dashboard() {
  const { userId, profile, refreshProfile } = useAuth();
  const { prices } = usePrices();
  const { push } = useToast();
  const navigate = useNavigate();

  const [wallets, setWallets] = useState<Wallet[] | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [allocation, setAllocation] = useState<WelcomeAllocation | null>(null);
  const [allocLoading, setAllocLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [activeTickets, setActiveTickets] = useState<number | null>(null);

  const displayName = profile?.full_name?.split(' ')[0] || profile?.username || 'Member';

  const loadAllocation = useCallback(async () => {
    if (!userId) return;
    const { data } = await getClient().from('welcome_allocations').select('*').eq('user_id', userId).maybeSingle();
    setAllocation((data as WelcomeAllocation | null) ?? null);
    setAllocLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const c = getClient();
    let alive = true;

    c.from('wallets').select('*').eq('user_id', userId).then(({ data }) => alive && setWallets((data as Wallet[]) ?? []));
    c.from('pools').select('*').eq('status', 'open').order('prize_usd', { ascending: false }).limit(3).then(({ data }) => alive && setPools((data as Pool[]) ?? []));
    c.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3).then(({ data }) => alive && setAnnouncements((data as Announcement[]) ?? []));
    c.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(4).then(({ data }) => alive && setRecentTx((data as Transaction[]) ?? []));
    c.from('recent_entries').select('*').limit(8).then(({ data }) => alive && setRecentEntries((data as RecentEntry[]) ?? []));
    c.from('tickets').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active').then(({ count }) => alive && setActiveTickets(count ?? 0));
    loadAllocation();

    // realtime: pools + own wallets + own allocation
    const ch = c.channel('dash-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pools' }, (payload) => {
        const p = payload.new as Pool;
        setPools((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, () => {
        c.from('wallets').select('*').eq('user_id', userId).then(({ data }) => alive && setWallets((data as Wallet[]) ?? []));
      })
      .subscribe();

    return () => { alive = false; c.removeChannel(ch); };
  }, [userId, loadAllocation]);

  const totals = useMemo(() => {
    if (!wallets) return { availableUsd: 0, lockedUsd: 0 };
    let availableUsd = 0, lockedUsd = 0;
    for (const w of wallets) {
      const rate = prices[w.asset]?.usd ?? (w.asset === 'USDT' || w.asset === 'USDC' ? 1 : 0);
      availableUsd += Number(w.available) * rate;
      lockedUsd += Number(w.locked) * rate;
    }
    return { availableUsd, lockedUsd };
  }, [wallets, prices]);

  const claimWelcome = async () => {
    setClaiming(true);
    try {
      const { data, error } = await getClient().rpc('claim_welcome_allocation');
      if (error) throw error;
      const res = data as { already_claimed: boolean; btc_amount: number; rate: number; conversion_ref: string };
      if (res.already_claimed) {
        push('info', 'Already claimed', 'Your welcome allocation was issued previously and is on your account.');
      } else {
        push('gold', '$80,000 allocated → BTC conversion recorded', `${Number(res.btc_amount).toFixed(8)} BTC @ $${Number(res.rate).toLocaleString()} · ref ${res.conversion_ref}`);
      }
      await loadAllocation();
      await refreshProfile();
      const { data: ws } = await getClient().from('wallets').select('*').eq('user_id', userId);
      setWallets((ws as Wallet[]) ?? []);
    } catch (e) {
      push('error', 'Welcome allocation failed', friendlyError(e));
    } finally {
      setClaiming(false);
    }
  };

  const btcHolding = wallets?.find((w) => w.asset === 'BTC');

  return (
    <div className="space-y-5">
      {/* ===== welcome / allocation hero ===== */}
      {!allocLoading && !allocation ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card sheen className="relative overflow-hidden p-6 sm:p-8 border-gold-500/40 gold-ring">
            <div className="absolute -right-6 -top-8 opacity-95 pointer-events-none select-none">
              <img src="/assets/coin-hero.png" alt="" className="w-36 sm:w-44 float-slow drop-shadow-[0_16px_36px_rgba(226,166,46,0.45)]" />
            </div>
            <div className="relative max-w-lg">
              <span className="chip chip-open"><Sparkles size={10} /> First-session benefit</span>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-50 mt-3 leading-[1.08]">$80,000 <span className="gold-text">welcome allocation</span> awaits</h1>
              <p className="text-[12.5px] text-zinc-400 mt-3 leading-relaxed">Claim now. We convert it to BTC at the live treasury oracle rate, lock it in your wallet, and release it the moment your first qualifying funding deposit is verified on-chain.</p>
              <DCLButton gold size="lg" className="mt-5" loading={claiming} onClick={claimWelcome}>
                <Coins size={17} /> Claim &amp; Convert to BTC
              </DCLButton>
              <p className="text-[9.5px] text-zinc-600 mt-3 font-mono">One-time per account · recorded in immutable ledger · locked until verified funding</p>
            </div>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card sheen className="p-4 sm:p-5 col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.16em] text-zinc-500 font-extrabold flex items-center gap-1.5"><WalletIcon size={11} className="text-gold-400" />Available balance</div>
                <div className="font-mono text-[24px] sm:text-[30px] font-semibold text-zinc-50 mt-1.5 leading-none">{fmtUsd(totals.availableUsd)}</div>
                {totals.lockedUsd > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-gold-300/90 font-semibold"><Lock size={10.5} />{fmtUsd(totals.lockedUsd)} locked welcome BTC — <Link to="/app/wallet?tab=official" className="underline underline-offset-2 hover:text-gold-100">how to unlock</Link></div>
                )}
              </div>
              <img src="/assets/coin-sleepy.png" alt="" className="w-20 sm:w-24 shrink-0 float-slow select-none pointer-events-none" loading="lazy" />
            </div>
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="text-[9.5px] uppercase tracking-[0.16em] text-zinc-500 font-extrabold flex items-center gap-1.5"><Ticket size={11} className="text-gold-400" />Active tickets</div>
            <div className="font-mono text-[26px] sm:text-[30px] font-semibold text-zinc-50 mt-1.5 leading-none">{activeTickets ?? '—'}</div>
            <Link to="/app/tickets" className="text-[10px] text-gold-400 hover:text-gold-200 font-bold mt-2 inline-flex items-center gap-1">View tickets <ChevronRight size={10} /></Link>
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="text-[9.5px] uppercase tracking-[0.16em] text-zinc-500 font-extrabold flex items-center gap-1.5"><TrendingUp size={11} className="text-gold-400" />BTC holding</div>
            <div className="font-mono text-[17px] sm:text-[21px] font-semibold text-gold-200 mt-2 leading-none">{btcHolding ? fmtCrypto(Number(btcHolding.available) + Number(btcHolding.locked)) : '0'} BTC</div>
            <div className="text-[9.5px] text-zinc-500 font-mono mt-1.5">{btcHolding && Number(btcHolding.locked) > 0 ? `${fmtCrypto(Number(btcHolding.locked))} locked` : 'fully unlocked'}</div>
          </Card>
        </div>
      )}

      {/* ===== locked allocation banner ===== */}
      {allocation && allocation.status === 'locked' && (
        <Card className="p-4 sm:p-5 border-gold-500/45 locked-veil flex flex-col sm:flex-row sm:items-center gap-4">
          <Lock size={26} className="text-gold-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-extrabold text-gold-100">{fmtCrypto(Number(allocation.btc_amount))} BTC welcome allocation — locked</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Auto-converted from $80,000 @ ${Number(allocation.rate).toLocaleString()} · ref {allocation.conversion_ref}. Unlocks after a ≥ ${Number(allocation.unlock_requirement_usd).toLocaleString()} qualifying deposit is verified on-chain by the treasury.</p>
          </div>
          <DCLButton gold size="sm" onClick={() => navigate('/app/wallet?tab=official')}><ShieldCheck size={13} /> How to unlock</DCLButton>
        </Card>
      )}
      {allocation && allocation.status === 'unlocked' && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-400/6 px-4 py-3">
          <BadgeCheck size={17} className="text-emerald-400 shrink-0" />
          <p className="text-[12px] text-emerald-200 font-semibold">Welcome allocation unlocked — {fmtCrypto(Number(allocation.btc_amount))} BTC is fully spendable in your wallet.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ===== pools column ===== */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[16px] tracking-[0.1em] uppercase text-gold-100 flex items-center gap-2"><Trophy size={15} className="text-gold-400" />Open pools</h2>
            <Link to="/app/pools" className="text-[11px] font-bold text-gold-300 hover:text-gold-100 flex items-center gap-1">All pools <ChevronRight size={11} /></Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {pools.length === 0 && <CardSkeleton />}
            {pools.slice(0, 2).map((p) => {
              const ratio = p.tickets_sold / p.capacity;
              return (
                <Card key={p.id} hover sheen className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AssetIcon symbol={p.prize_asset} size={30} />
                      <div>
                        <h3 className="text-[13px] font-extrabold text-zinc-100 leading-tight">{p.name}</h3>
                        <p className="text-[9px] text-zinc-500 font-mono mt-0.5">closes {timeLeft(p.closes_at)}</p>
                      </div>
                    </div>
                    <span className="chip chip-live"><span className="pulse-dot !w-1.5 !h-1.5" />Live</span>
                  </div>
                  <div className="font-mono gold-text text-[26px] font-bold mt-3">{fmtCrypto(Number(p.prize_amount))} {p.prize_asset}</div>
                  <div className="text-[10px] text-zinc-500 font-mono -mt-1">≈ {fmtUsd(Number(p.prize_usd), 0)} guaranteed pool</div>
                  <div className="mt-3 mb-1.5 flex items-center justify-between text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider">
                    <span>{p.tickets_sold}/{p.capacity} tickets</span>
                    <span>{Math.round(ratio * 100)}% sold</span>
                  </div>
                  <ProgressBar ratio={ratio} />
                  <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] text-zinc-300 font-semibold">{fmtCrypto(Number(p.ticket_price))} {p.asset}<span className="text-zinc-600"> / ticket</span></span>
                    <DCLButton gold size="sm" onClick={() => navigate('/app/pools')}><Ticket size={12} /> Enter</DCLButton>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* recent activity feed */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="font-display text-[16px] tracking-[0.1em] uppercase text-gold-100 flex items-center gap-2"><Coins size={15} className="text-gold-400" />Recent draws across the hall</h2>
          </div>
          <Card className="divide-y divide-white/5 overflow-hidden">
            {recentEntries.length === 0 ? (
              <p className="text-[11.5px] text-zinc-500 px-5 py-6 text-center">No entries yet — the first tickets will appear here.</p>
            ) : recentEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-gold-500/4 transition-colors">
                <Ticket size={13} className="text-gold-500 shrink-0" />
                <span className="font-mono text-[10.5px] text-zinc-500 shrink-0">{e.ticket_number}</span>
                <span className="text-[11px] text-zinc-300 font-semibold truncate">{e.masked_member}</span>
                <span className="text-[10px] text-zinc-600 truncate hidden sm:inline">entered {e.pool_name}</span>
                <span className="ml-auto text-[9.5px] text-zinc-600 font-mono shrink-0">{timeAgo(e.created_at)}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* ===== sidebar column ===== */}
        <div className="space-y-5">
          {/* quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: ArrowDownLeft, label: 'Receive', to: '/app/wallet?tab=receive' },
              { icon: ArrowUpRight, label: 'Send', to: '/app/wallet?tab=send' },
              { icon: ArrowLeftRight, label: 'Swap', to: '/app/wallet?tab=swap' },
              { icon: Ticket, label: 'Pools', to: '/app/pools' },
            ].map(({ icon: I, label, to }) => (
              <Link key={label} to={to} className="glass rounded-2xl py-3.5 flex flex-col items-center gap-1.5 hover:border-gold-500/40 transition-all group">
                <I size={18} className="text-gold-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-extrabold text-zinc-400 group-hover:text-gold-100 tracking-wide">{label}</span>
              </Link>
            ))}
          </div>

          {/* announcements */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-[13px] tracking-[0.1em] uppercase text-gold-100 flex items-center gap-2"><Megaphone size={13} className="text-gold-400" />Announcements</h2>
              <Link to="/app/announcements" className="text-[10.5px] font-bold text-gold-300 hover:text-gold-100">View all</Link>
            </div>
            <Card className="divide-y divide-white/5">
              {announcements.length === 0 ? (
                <p className="text-[11px] text-zinc-500 px-4 py-5">No announcements yet.</p>
              ) : announcements.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {a.is_pinned && <Pin size={11} className="text-gold-400 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-bold text-zinc-100 leading-snug">{a.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 leading-snug">{a.body}</p>
                      <p className="text-[8.5px] text-zinc-600 font-mono mt-1.5">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* recent transactions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-[13px] tracking-[0.1em] uppercase text-gold-100 flex items-center gap-2"><ArrowLeftRight size={13} className="text-gold-400" />Your ledger</h2>
              <Link to="/app/wallet?tab=activity" className="text-[10.5px] font-bold text-gold-300 hover:text-gold-100">Full history</Link>
            </div>
            <Card className="divide-y divide-white/5">
              {recentTx.length === 0 ? (
                <p className="text-[11px] text-zinc-500 px-4 py-5">No transactions yet — claim your allocation to begin.</p>
              ) : recentTx.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.direction === 'credit' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>
                    {t.direction === 'credit' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-zinc-200 capitalize truncate">{t.type.replace(/_/g, ' ')}</p>
                    <p className="text-[8.5px] text-zinc-600 font-mono">{t.ref}</p>
                  </div>
                  <span className={`ml-auto font-mono text-[11px] font-semibold shrink-0 ${t.direction === 'credit' ? 'text-emerald-300' : 'text-zinc-300'}`}>{t.direction === 'credit' ? '+' : '−'}{fmtCrypto(Number(t.amount))} {t.asset}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
