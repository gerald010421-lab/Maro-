import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, Clock, Users, ShieldCheck, Minus, Plus, Trophy, BadgeCheck, Info, Loader2, Sparkles, ScrollText,
} from 'lucide-react';
import { useAuth, usePrices, useToast } from '../lib/context';
import { getClient, friendlyError } from '../lib/supabase';
import type { Pool, Wallet } from '../lib/types';
import { fmtCrypto, fmtUsd, timeLeft, fullDate } from '../lib/format';
import { Card, CardSkeleton, DCLButton, Modal, ProgressBar, EmptyState } from '../components/ui';
import { AssetIcon } from '../lib/cryptoAssets';

export default function Pools() {
  const { userId } = useAuth();
  const { prices } = usePrices();
  const { push } = useToast();
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [wallets, setWallets] = useState<Record<string, Wallet>>({});
  const [selected, setSelected] = useState<Pool | null>(null);
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const c = getClient();
    const [{ data: p }, { data: w }] = await Promise.all([
      c.from('pools').select('*').in('status', ['open', 'closed', 'drawn']).order('status', { ascending: true }).order('closes_at', { ascending: true }),
      c.from('wallets').select('*').eq('user_id', userId),
    ]);
    setPools((p as Pool[]) ?? []);
    setWallets(Object.fromEntries(((w as Wallet[]) ?? []).map((x) => [x.asset, x])));
  }, [userId]);

  useEffect(() => {
    load();
    const c = getClient();
    const ch = c.channel('pools-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools' }, (payload) => {
        const p = payload.new as Pool;
        setPools((prev) => prev ? prev.map((x) => (x.id === p.id ? p : x)) : prev);
        setSelected((s) => (s && s.id === p.id ? p : s));
      })
      .subscribe();
    return () => { c.removeChannel(ch); };
  }, [load]);

  const openPools = useMemo(() => (pools ?? []).filter((p) => p.status === 'open' && (!p.closes_at || new Date(p.closes_at).getTime() > now)), [pools, now]);
  const closedPools = useMemo(() => (pools ?? []).filter((p) => !openPools.includes(p)), [pools, openPools]);

  const selectedWallet = selected ? wallets[selected.asset] : undefined;
  const totalPrice = selected ? Number(selected.ticket_price) * qty : 0;
  const available = selectedWallet ? Number(selectedWallet.available) : 0;
  const canAfford = totalPrice > 0 && available >= totalPrice;
  const remaining = selected ? selected.capacity - selected.tickets_sold : 0;

  const buy = async () => {
    if (!selected || buying) return;
    setBuying(true);
    try {
      const idem = `buy:${selected.id}:${userId}:${Date.now()}`;
      const { data, error } = await getClient().rpc('purchase_tickets', {
        p_pool_id: selected.id,
        p_quantity: qty,
        p_idempotency_key: idem,
      });
      if (error) throw error;
      const res = data as { tickets: Array<{ ticket_number: string }>; tx_ref: string; total_charged: number; asset: string };
      push('gold', `${res.tickets.length} ticket${res.tickets.length > 1 ? 's' : ''} confirmed`, `Charged ${fmtCrypto(Number(res.total_charged))} ${res.asset} · ref ${res.tx_ref}`);
      setSelected(null);
      setQty(1);
      await load();
    } catch (e) {
      push('error', 'Purchase failed', friendlyError(e));
      await load();
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold"><Trophy size={12} />Draw Hall</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-50 mt-1">Lottery <span className="gold-text">Pools</span></h1>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-md">Every pool is prize-funded before opening. Winners drawn by auditable SHA-256 selection at close.</p>
        </div>
        <button onClick={() => setRulesOpen(true)} className="btn-ghost-gold inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[11px]"><ScrollText size={13} />Entry conditions &amp; draw rules</button>
      </div>

      {/* skeletons */}
      {pools === null && <div className="grid md:grid-cols-2 gap-5"><CardSkeleton /><CardSkeleton /></div>}

      {/* empty */}
      {pools !== null && openPools.length === 0 && closedPools.length === 0 && (
        <Card><EmptyState icon={<Ticket size={26} />} title="No pools open right now" body="The treasury publishes new draws weekly. Enable notifications to be pinged the moment a pool opens." /></Card>
      )}

      {/* open pools grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {openPools.map((p) => {
          const ratio = p.tickets_sold / p.capacity;
          const remain = p.capacity - p.tickets_sold;
          const urgent = remain <= 25 || (p.closes_at && new Date(p.closes_at).getTime() - now < 6 * 3600000);
          return (
            <motion.div layout key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <Card hover sheen className="p-0 overflow-hidden flex flex-col h-full">
                <div className="relative p-5 pb-4 border-b border-gold-500/14 bg-gradient-to-br from-gold-500/10 via-transparent to-transparent">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AssetIcon symbol={p.prize_asset} size={44} className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]" />
                      <div>
                        <h2 className="font-display text-[16px] text-zinc-50 leading-tight">{p.name}</h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{p.subtitle}</p>
                      </div>
                    </div>
                    {p.prize_funded && <span className="chip chip-paid shrink-0" title="Prize is held in treasury custody"><BadgeCheck size={10} />Funded</span>}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold">Prize</div>
                      <div className="font-mono gold-text text-[30px] leading-none font-bold">{fmtCrypto(Number(p.prize_amount))} <span className="text-sm">{p.prize_asset}</span></div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1">≈ {fmtUsd(Number(p.prize_usd), 0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold">Closes in</div>
                      <div className={`font-mono text-[15px] font-semibold ${urgent ? 'text-rose-300' : 'text-zinc-100'}`}>{timeLeft(p.closes_at)}</div>
                      <div className="text-[8.5px] text-zinc-600 font-mono">{p.closes_at ? fullDate(p.closes_at) : ''}</div>
                    </div>
                  </div>
                </div>
                <div className="p-5 pt-4 mt-auto">
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.15em] font-extrabold text-zinc-500 mb-1.5">
                    <span className="flex items-center gap-1.5"><Users size={10.5} />{p.tickets_sold} / {p.capacity} sold</span>
                    <span className={urgent ? 'text-rose-300' : ''}>{remain} remaining</span>
                  </div>
                  <ProgressBar ratio={ratio} />
                  <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
                    <div>
                      <span className="font-mono text-[15px] text-zinc-100 font-semibold">{fmtCrypto(Number(p.ticket_price))} {p.asset}</span>
                      <span className="text-[9px] text-zinc-600 block font-sans">per ticket · max {p.max_tickets_per_user}/member</span>
                    </div>
                    <DCLButton gold onClick={() => { setSelected(p); setQty(1); }}><Ticket size={14} />Buy Ticket</DCLButton>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* closed / drawn / paid pools */}
      {closedPools.length > 0 && (
        <div>
          <h2 className="font-display text-[13px] uppercase tracking-[0.15em] text-zinc-500 mb-3">Settled &amp; closed draws</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {closedPools.map((p) => (
              <Card key={p.id} className="p-4 flex items-center gap-3 opacity-85">
                <Trophy size={18} className="text-gold-700 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-zinc-300 truncate">{p.name}</p>
                  <p className="text-[9.5px] text-zinc-600 font-mono">{p.status.toUpperCase()} · {p.tickets_sold} tickets · {fmtCrypto(Number(p.prize_amount))} {p.prize_asset} prize</p>
                </div>
                <span className={`chip ml-auto ${p.status === 'paid' ? 'chip-paid' : 'chip-drawn'}`}>{p.status}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ============ PURCHASE MODAL ============ */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Confirm Purchase">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gold-500/25 bg-gold-500/6 p-4 flex items-center gap-3">
              <AssetIcon symbol={selected.prize_asset} size={40} />
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-zinc-100">{selected.name}</p>
                <p className="text-[10px] text-zinc-500 font-mono">Prize {fmtCrypto(Number(selected.prize_amount))} {selected.prize_asset} · {remaining} tickets left · closes {timeLeft(selected.closes_at)}</p>
              </div>
            </div>

            {/* quantity stepper */}
            <div>
              <label className="flabel">Ticket quantity</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-11 rounded-xl border border-gold-500/35 text-gold-300 hover:bg-gold-500/10 flex items-center justify-center" aria-label="Decrease"><Minus size={16} /></button>
                <input type="number" min={1} max={Math.min(remaining, selected.max_tickets_per_user)} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(Math.min(remaining, selected.max_tickets_per_user), Math.floor(Number(e.target.value) || 1))))} className="field text-center font-mono text-lg !py-2.5" aria-label="Quantity" />
                <button onClick={() => setQty((q) => Math.min(Math.min(remaining, selected.max_tickets_per_user), q + 1))} className="w-11 h-11 rounded-xl border border-gold-500/35 text-gold-300 hover:bg-gold-500/10 flex items-center justify-center" aria-label="Increase"><Plus size={16} /></button>
              </div>
              <div className="flex gap-1.5 mt-2">{[1, 5, 10, 25].map((n) => <button key={n} onClick={() => setQty(Math.min(n, Math.min(remaining, selected.max_tickets_per_user)))} className="text-[10px] font-bold font-mono px-2.5 py-1.5 rounded-lg border border-white/10 text-zinc-400 hover:text-gold-200 hover:border-gold-500/40">+{n}</button>)}</div>
            </div>

            {/* order summary */}
            <div className="rounded-2xl border border-white/8 bg-black/45 divide-y divide-white/6 text-[12px]">
              <div className="flex justify-between px-4 py-2.5"><span className="text-zinc-500">Price per ticket</span><span className="font-mono text-zinc-200">{fmtCrypto(Number(selected.ticket_price))} {selected.asset}{prices[selected.asset] && <span className="text-zinc-600"> ≈ {fmtUsd(Number(selected.ticket_price) * prices[selected.asset].usd)}</span>}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-zinc-500">Quantity</span><span className="font-mono text-zinc-200">× {qty}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-zinc-500">Your available {selected.asset}</span><span className={`font-mono ${canAfford ? 'text-zinc-200' : 'text-rose-300'}`}>{fmtCrypto(available)} {selected.asset}</span></div>
              <div className="flex justify-between px-4 py-3"><span className="text-zinc-300 font-bold">Total charge</span><span className="font-mono text-gold-200 font-bold text-[15px]">{fmtCrypto(totalPrice)} {selected.asset}</span></div>
            </div>

            {!canAfford && <p className="text-[11px] text-rose-300 flex items-center gap-1.5"><Info size={12} />Insufficient available balance. Locked welcome BTC cannot be spent — <button className="underline" onClick={() => setSelected(null)}>unlock via funding</button>.</p>}

            <DCLButton gold size="lg" className="w-full" disabled={!canAfford} loading={buying} onClick={buy}>
              {buying ? <>Processing…</> : <><ShieldCheck size={16} />Confirm — {fmtCrypto(totalPrice)} {selected.asset}</>}
            </DCLButton>
            <p className="text-[9px] text-zinc-600 text-center font-mono leading-relaxed">Atomic debit · tickets issued in the same transaction · oversell prevented by row lock<br />Idempotency-keyed — double-taps never double-charge</p>
          </div>
        )}
      </Modal>

      {/* ============ RULES MODAL ============ */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Entry Conditions & Draw Method" maxWidth="max-w-xl">
        <div className="space-y-4 text-[12px] text-zinc-400 leading-relaxed">
          <section>
            <h4 className="text-gold-200 font-extrabold text-[11px] uppercase tracking-[0.15em] mb-1.5"><Sparkles size={11} className="inline mr-1" />Eligibility</h4>
            Tickets may be purchased by any verified member with sufficient <em>available</em> balance in the pool's asset. Locked welcome-allocation funds are not spendable. Minimum age 18. One account per person; multi-accounting forfeits tickets without refund of platform fees.
          </section>
          <section>
            <h4 className="text-gold-200 font-extrabold text-[11px] uppercase tracking-[0.15em] mb-1.5">Prize funding</h4>
            Every open pool displays a <span className="chip chip-paid !text-[8px] align-middle">Funded</span> badge only when the prize asset is held under treasury custody. A pool without the badge never opens. Prize amounts are fixed at creation and do not depend on ticket revenue.
          </section>
          <section>
            <h4 className="text-gold-200 font-extrabold text-[11px] uppercase tracking-[0.15em] mb-1.5">Closing rules</h4>
            Pools close at capacity or at the published deadline, whichever comes first. Purchases are rejected after closure. If capacity is not reached by the deadline, the draw proceeds with tickets sold; if zero tickets were sold the pool closes with no draw.
          </section>
          <section>
            <h4 className="text-gold-200 font-extrabold text-[11px] uppercase tracking-[0.15em] mb-1.5">Winner selection</h4>
            At close, an administrator triggers the draw. The winning ticket index is derived from SHA-256 of <code className="text-gold-300 font-mono text-[10.5px]">pool_id | close_timestamp | first_ticket_id | server_salt</code>. The seed hash and index are written to the pool record — anyone can recompute them. Administrative draws outside published rules are prohibited.
          </section>
          <section>
            <h4 className="text-gold-200 font-extrabold text-[11px] uppercase tracking-[0.15em] mb-1.5">Payout process</h4>
            Winning tickets are marked at draw time. The prize is credited on-chain by the treasury within 72 hours; the payout transaction reference is published on the pool record and in the winner's notifications. A draw is never marked “paid” without an on-chain reference.
          </section>
          <section>
            <h4 className="text-gold-200 font-extrabold text-[11px] uppercase tracking-[0.15em] mb-1.5">Refunds &amp; voids</h4>
            Pools voided for technical reasons refund ticket prices to the purchasing wallet automatically, provably recorded in the ledger. No cash conversion of prizes.
          </section>
        </div>
      </Modal>
    </div>
  );
}
