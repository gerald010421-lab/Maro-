import { useEffect, useState } from 'react';
import { Users, Ticket, ArrowDownLeft, Coins, Trophy, AlertCircle, ChevronRight, TrendingUp, Landmark } from 'lucide-react';
import { getClient } from '../../lib/supabase';
import { fmtUsd, fmtCrypto, timeAgo } from '../../lib/format';
import { Card, Skeleton } from '../../components/ui';
import type { AdminSection } from '../Admin';

interface Stats {
  users: number; ticketsSold: number; openPools: number; pendingDeposits: number;
  lockedBtc: number; lockedUsd: number; prizesPending: number; prizePoolUsd: number;
}

export default function AdminOverview({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState<Array<{ id: string; asset: string; amount: number; created_at: string; user_id: string }>>([]);
  const [recentPayouts, setRecentPayouts] = useState<Array<{ id: string; name: string; prize_asset: string; prize_amount: number; payout_tx: string | null; paid_at: string | null }>>([]);

  useEffect(() => {
    const c = getClient();
    (async () => {
      const [users, tickets, openPools, pending, locked, prizePool, drawn] = await Promise.all([
        c.from('profiles').select('id', { count: 'exact', head: true }),
        c.from('tickets').select('id', { count: 'exact', head: true }),
        c.from('pools').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        c.from('deposits').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirming']),
        c.from('wallets').select('locked').gt('locked', 0),
        c.from('pools').select('prize_usd').eq('status', 'open'),
        c.from('pools').select('id', { count: 'exact', head: true }).eq('status', 'drawn').eq('payout_status', 'pending'),
      ]);
      const lockedBtc = (locked.data ?? []).reduce((s, w) => s + Number(w.locked), 0);
      const { data: btcPrice } = await c.from('price_cache').select('usd').eq('symbol', 'BTC').maybeSingle();
      const prizePoolUsd = (prizePool.data ?? []).reduce((s, p) => s + Number(p.prize_usd), 0);
      setStats({
        users: users.count ?? 0,
        ticketsSold: tickets.count ?? 0,
        openPools: openPools.count ?? 0,
        pendingDeposits: pending.count ?? 0,
        lockedBtc,
        lockedUsd: lockedBtc * Number(btcPrice?.usd ?? 0),
        prizesPending: drawn.count ?? 0,
        prizePoolUsd,
      });
      const { data: pd } = await c.from('deposits').select('id, asset, amount, created_at, user_id').in('status', ['pending', 'confirming']).order('created_at', { ascending: true }).limit(5);
      setPendingDeposits((pd as typeof pendingDeposits) ?? []);
      const { data: payouts } = await c.from('pools').select('id, name, prize_asset, prize_amount, payout_tx, paid_at').eq('status', 'paid').order('paid_at', { ascending: false }).limit(4);
      setRecentPayouts((payouts as typeof recentPayouts) ?? []);
    })();
  }, []);

  const cards = stats ? [
    { label: 'Registered members', value: String(stats.users), icon: Users, section: 'users' as AdminSection, tone: 'text-zinc-100' },
    { label: 'Tickets in circulation', value: String(stats.ticketsSold), icon: Ticket, section: 'pools' as AdminSection, tone: 'text-zinc-100' },
    { label: 'Open pools', value: String(stats.openPools), icon: Trophy, section: 'pools' as AdminSection, tone: 'text-gold-200' },
    { label: 'Prize pool committed', value: fmtUsd(stats.prizePoolUsd, 0), icon: TrendingUp, section: 'pools' as AdminSection, tone: 'text-gold-200' },
    { label: 'Pending deposit reviews', value: String(stats.pendingDeposits), icon: ArrowDownLeft, section: 'deposits' as AdminSection, tone: stats.pendingDeposits > 0 ? 'text-amber-300' : 'text-zinc-100' },
    { label: 'Welcome BTC locked', value: `${fmtCrypto(stats.lockedBtc)} BTC`, icon: Coins, section: 'allocations' as AdminSection, tone: 'text-gold-200' },
    { label: 'Locked value (USD)', value: fmtUsd(stats.lockedUsd, 0), icon: Coins, section: 'allocations' as AdminSection, tone: 'text-gold-200' },
    { label: 'Prizes awaiting payout', value: String(stats.prizesPending), icon: AlertCircle, section: 'pools' as AdminSection, tone: stats.prizesPending > 0 ? 'text-rose-300' : 'text-zinc-100' },
  ] : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-50">Treasury <span className="gold-text">Operations</span></h1>
        <p className="text-[11px] text-zinc-500 mt-1">Live operational picture across members, pools, deposits and allocations.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats === null ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />) : cards.map(({ label, value, icon: I, section, tone }) => (
          <button key={label} onClick={() => onNavigate(section)} className="text-left glass rounded-2xl p-4 hover:border-amber-500/40 transition-all group">
            <I size={16} className="text-amber-500/90 mb-2" />
            <div className={`font-mono text-[17px] font-semibold leading-tight ${tone}`}>{value}</div>
            <div className="text-[8.5px] uppercase tracking-[0.13em] text-zinc-500 font-bold mt-1 flex items-center justify-between">{label}<ChevronRight size={10} className="text-zinc-700 group-hover:text-amber-400 transition-colors" /></div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* pending deposit queue */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-amber-200 flex items-center gap-2"><ArrowDownLeft size={13} />Deposit queue</h2>
            <button onClick={() => onNavigate('deposits')} className="text-[10.5px] font-bold text-gold-300 hover:text-gold-100">Open verification →</button>
          </div>
          {pendingDeposits.length === 0 ? <p className="text-[11px] text-zinc-600 py-6 text-center">Queue clear — every deposit has been reviewed.</p> : pendingDeposits.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <span className="font-mono text-[12px] text-zinc-100 font-semibold">{fmtCrypto(Number(d.amount))} {d.asset}</span>
              <span className="text-[9px] font-mono text-zinc-600 truncate max-w-[140px]">{d.user_id.slice(0, 8)}…</span>
              <span className="ml-auto text-[9px] text-zinc-600 font-mono">{timeAgo(d.created_at)}</span>
            </div>
          ))}
        </Card>

        {/* recent payouts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-amber-200 flex items-center gap-2"><Trophy size={13} />Recent prize payouts</h2>
            <button onClick={() => onNavigate('pools')} className="text-[10.5px] font-bold text-gold-300 hover:text-gold-100">Pool desk →</button>
          </div>
          {recentPayouts.length === 0 ? <p className="text-[11px] text-zinc-600 py-6 text-center">No prizes paid yet — drawn pools appear here after settlement.</p> : recentPayouts.map((p) => (
            <div key={p.id} className="py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] font-bold text-zinc-100 truncate">{p.name}</span>
                <span className="font-mono text-[11px] text-gold-200 shrink-0">{fmtCrypto(Number(p.prize_amount))} {p.prize_asset}</span>
              </div>
              <p className="text-[8.5px] text-zinc-600 font-mono mt-0.5 truncate">ref {p.payout_tx}{p.paid_at ? ` · paid ${timeAgo(p.paid_at)}` : ''}</p>
            </div>
          ))}
        </Card>
      </div>

      {/* broadcast shortcut */}
      <button onClick={() => onNavigate('addresses')} className="w-full glass rounded-2xl border-amber-500/30 p-4 sm:p-5 flex items-center gap-4 hover:border-amber-500/55 transition-all text-left group">
        <Landmark size={24} className="text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-extrabold text-amber-100">Publish or rotate a platform payment address</p>
          <p className="text-[10.5px] text-zinc-500 mt-0.5">Changes broadcast in real time to every member's wallet. Copied exactly, character-for-character.</p>
        </div>
        <ChevronRight size={18} className="ml-auto text-zinc-600 group-hover:text-amber-300 transition-colors" />
      </button>
    </div>
  );
}
