import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Trophy, BadgeCheck, TicketX, Coins, ChevronRight } from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { getClient } from '../lib/supabase';
import type { Ticket as TicketRow } from '../lib/types';
import { fmtCrypto, timeAgo } from '../lib/format';
import { Card, EmptyState, Skeleton } from '../components/ui';

export default function Tickets() {
  const { userId } = useAuth();
  const { push } = useToast();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'won' | 'lost'>('all');

  useEffect(() => {
    if (!userId) return;
    const c = getClient();
    c.from('tickets')
      .select('*, pool:pools(name, prize_asset, prize_amount, prize_usd, status)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) { push('error', 'Could not load tickets', error.message); setTickets([]); return; }
        setTickets((data as TicketRow[]) ?? []);
      });
  }, [userId, push]);

  const filtered = (tickets ?? []).filter((t) => filter === 'all' || t.status === filter);
  const wins = (tickets ?? []).filter((t) => t.status === 'won').length;
  const active = (tickets ?? []).filter((t) => t.status === 'active').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold"><Ticket size={12} />Entry Ledger</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-50 mt-1">My <span className="gold-text">Tickets</span></h1>
          <p className="text-[11px] text-zinc-500 mt-1">Every ticket you hold, permanently recorded on the treasury ledger.</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'won', 'lost'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border transition-all ${filter === f ? 'border-gold-500/50 text-gold-200 bg-gold-500/12' : 'border-white/8 text-zinc-500 hover:text-zinc-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Ticket, label: 'Total tickets', value: String(tickets?.length ?? '—') },
          { icon: Coins, label: 'Active tickets', value: String(active) },
          { icon: Trophy, label: 'Wins', value: String(wins), tone: wins > 0 ? 'text-gold-200' : undefined },
        ].map(({ icon: I, label, value, tone }) => (
          <Card key={label} className="p-4 text-center">
            <I size={16} className="text-gold-500 mx-auto mb-1.5" />
            <div className={`font-mono text-lg font-semibold ${tone ?? 'text-zinc-100'}`}>{value}</div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 font-bold">{label}</div>
          </Card>
        ))}
      </div>

      {tickets === null && <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>}

      {tickets !== null && filtered.length === 0 && (
        <Card>
          <EmptyState icon={<TicketX size={26} />} title={filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`} body="Enter a live pool and your tickets will appear here — sealed, numbered, and ledgered forever." action={<Link to="/app/pools" className="btn-gold rounded-xl px-5 py-2.5 text-[12px] inline-flex items-center gap-2"><Ticket size={14} />Browse open pools <ChevronRight size={13} /></Link>} />
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((t) => {
          const won = t.status === 'won';
          return (
            <div key={t.id} className={`relative rounded-2xl border p-[1.5px] ${won ? 'bg-gradient-to-br from-gold-300 via-gold-600 to-gold-800 gold-ring' : 'bg-gradient-to-br from-gold-500/30 via-white/5 to-transparent'}`}>
              <div className="rounded-2xl bg-[#120e0a] p-4 h-full flex flex-col relative overflow-hidden">
                {/* perforation */}
                <div aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full bg-[#050403]" />
                <div aria-hidden="true" className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 w-4 h-4 rounded-full bg-[#050403]" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[8.5px] uppercase tracking-[0.25em] text-zinc-600 font-extrabold">Digital Coin Lottery</div>
                    <div className="font-mono text-[15px] font-semibold text-gold-100 mt-0.5 tracking-wide">{t.ticket_number}</div>
                  </div>
                  {won ? <span className="chip chip-paid"><BadgeCheck size={10} />Winner</span> : t.status === 'active' ? <span className="chip chip-open">Active</span> : <span className="chip chip-gray">{t.status}</span>}
                </div>
                <div className="border-t border-dashed border-white/10 my-3" />
                <p className="text-[12px] font-bold text-zinc-200 truncate">{t.pool?.name ?? 'Pool'}</p>
                <div className="flex items-end justify-between mt-auto pt-3">
                  <div>
                    <div className="text-[8.5px] uppercase tracking-[0.18em] text-zinc-600 font-bold">Prize</div>
                    <div className="font-mono text-[12.5px] text-zinc-300">{t.pool ? <>{fmtCrypto(Number(t.pool.prize_amount))} {t.pool.prize_asset}</> : '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8.5px] uppercase tracking-[0.18em] text-zinc-600 font-bold">Paid</div>
                    <div className="font-mono text-[12.5px] text-zinc-300">{fmtCrypto(Number(t.price_paid))} {t.asset}</div>
                  </div>
                </div>
                <div className="text-[8.5px] text-zinc-700 font-mono mt-2">issued {timeAgo(t.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
