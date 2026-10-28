import { useCallback, useEffect, useState } from 'react';
import { Ticket, Plus, BadgeCheck, Trophy, CheckCircle2, Dices, Info } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import type { Pool } from '../../lib/types';
import { fmtCrypto, fmtUsd, timeLeft, fullDate } from '../../lib/format';
import { Card, DCLButton, Modal, Field, EmptyState, Skeleton, ProgressBar } from '../../components/ui';
import { AssetIcon } from '../../lib/cryptoAssets';

export default function AdminPools() {
  const { push } = useToast();
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [payoutRef, setPayoutRef] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await getClient().from('pools').select('*').order('created_at', { ascending: false });
    if (error) push('error', 'Load failed', friendlyError(error));
    setPools((data as Pool[]) ?? []);
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const draw = async (p: Pool) => {
    if (!window.confirm(`Close "${p.name}" and draw a winner now?\n\n${p.tickets_sold} ticket(s) entered. Selection is SHA-256 verifiable and irreversible.`)) return;
    setBusy(p.id);
    try {
      const { data, error } = await getClient().rpc('admin_close_and_draw', { p_pool_id: p.id });
      if (error) throw error;
      const res = data as { status: string; winner_ticket?: string; winning_index?: number; tickets_entered?: number; seed_hash?: string; message?: string };
      if (res.winner_ticket) {
        push('gold', 'Winner drawn — verifiable selection', `Ticket ${res.winner_ticket} won (index ${res.winning_index} of ${res.tickets_entered}). Seed hash ${String(res.seed_hash).slice(0, 16)}…`);
      } else {
        push('info', 'Pool closed', res.message ?? 'No tickets sold.');
      }
      await load();
    } catch (e) {
      push('error', 'Draw failed', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (p: Pool) => {
    const ref = (payoutRef[p.id] ?? '').trim();
    if (ref.length < 6) { push('error', 'Payout reference required', 'Enter the on-chain transaction reference of the prize payment.'); return; }
    setBusy(p.id);
    try {
      const { error } = await getClient().rpc('admin_mark_prize_paid', { p_pool_id: p.id, p_tx_ref: ref });
      if (error) throw error;
      push('success', 'Prize marked paid', 'Winner wallet credited and notified. Reference archived on the pool.');
      await load();
    } catch (e) {
      push('error', 'Payout failed', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleFunded = async (p: Pool) => {
    setBusy(p.id);
    try {
      const { error } = await getClient().from('pools').update({ prize_funded: !p.prize_funded }).eq('id', p.id);
      if (error) throw error;
      push('info', p.prize_funded ? 'Prize funding flag cleared' : 'Prize funding confirmed', p.prize_funded ? 'The Funded badge is removed from this pool.' : 'Treasury custody of the prize is now displayed to members.');
      await load();
    } catch (e) { push('error', 'Update failed', friendlyError(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><Ticket size={20} className="text-amber-400" />Pool <span className="gold-text">Desk</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1">Create, close, draw and settle pools. Draws are irreversible and auditable.</p>
        </div>
        <DCLButton gold onClick={() => setCreateOpen(true)}><Plus size={15} />New pool</DCLButton>
      </div>

      {pools === null && [1, 2].map((i) => <Skeleton key={i} className="h-44" />)}
      {pools !== null && pools.length === 0 && <Card><EmptyState icon={<Ticket size={26} />} title="No pools yet" body="Create the first flagship draw — it opens to members immediately." action={<DCLButton gold onClick={() => setCreateOpen(true)}><Plus size={14} />Create pool</DCLButton>} /></Card>}

      <div className="space-y-4">
        {(pools ?? []).map((p) => {
          const ratio = p.capacity > 0 ? p.tickets_sold / p.capacity : 0;
          return (
            <Card key={p.id} sheen className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <AssetIcon symbol={p.prize_asset} size={46} />
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[14px] font-extrabold text-zinc-50">{p.name}</h2>
                    <span className={`chip ${p.status === 'open' ? 'chip-live' : p.status === 'paid' ? 'chip-paid' : 'chip-drawn'}`}>{p.status}</span>
                    {p.prize_funded && <span className="chip chip-paid"><BadgeCheck size={9} />Funded</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 text-[10px] font-mono text-zinc-400">
                    <span>prize {fmtCrypto(Number(p.prize_amount))} {p.prize_asset}</span>
                    <span>price {fmtCrypto(Number(p.ticket_price))} {p.asset}</span>
                    <span>{p.tickets_sold}/{p.capacity} sold ({Math.round(ratio * 100)}%)</span>
                    <span>{p.status === 'open' ? `closes ${timeLeft(p.closes_at)}` : p.drawn_at ? `drawn ${fullDate(p.drawn_at)}` : 'closed'}</span>
                  </div>
                  <ProgressBar ratio={ratio} className="mt-2.5 max-w-md" />
                  {p.status === 'drawn' && (
                    <div className="mt-3 rounded-xl border border-violet-400/30 bg-violet-400/6 px-3.5 py-2.5 flex items-center gap-2.5">
                      <Trophy size={15} className="text-violet-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10.5px] text-violet-200 font-bold">Winner drawn — payout {p.payout_status === 'paid' ? 'complete' : 'pending'} </p>
                        <p className="text-[8.5px] text-zinc-500 font-mono truncate">{p.draw_method}</p>
                      </div>
                    </div>
                  )}
                  {p.status === 'paid' && p.payout_tx && (
                    <p className="text-[9px] text-emerald-400/80 font-mono mt-2">paid · ref {p.payout_tx}{p.paid_at ? ` · ${fullDate(p.paid_at)}` : ''}</p>
                  )}
                </div>

                {/* actions */}
                <div className="flex flex-col gap-2 w-full sm:w-64 shrink-0">
                  <button onClick={() => toggleFunded(p)} disabled={busy === p.id} className="text-left text-[9.5px] font-bold px-3 py-2 rounded-lg border border-white/10 hover:border-gold-500/40 text-zinc-400 hover:text-gold-200 transition-all">
                    {p.prize_funded ? '✓ Treasury holds prize — click to revoke flag' : '○ Mark prize as treasury-funded'}
                  </button>
                  {p.status === 'open' && (
                    <DCLButton gold size="sm" loading={busy === p.id} onClick={() => draw(p)}><Dices size={13} />Close &amp; draw winner</DCLButton>
                  )}
                  {p.status === 'drawn' && p.payout_status !== 'paid' && (
                    <>
                      <input className="field font-mono !text-[10px] !py-2" placeholder="On-chain payout tx reference…" value={payoutRef[p.id] ?? ''} onChange={(e) => setPayoutRef((prev) => ({ ...prev, [p.id]: e.target.value }))} aria-label="Payout reference" />
                      <DCLButton gold size="sm" loading={busy === p.id} onClick={() => markPaid(p)}><CheckCircle2 size={13} />Mark paid — credit winner</DCLButton>
                    </>
                  )}
                  {p.status === 'paid' && <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 justify-center py-2"><CheckCircle2 size={12} />Settled — ledger sealed</div>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <CreatePoolModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={load} />
    </div>
  );
}

function CreatePoolModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', subtitle: '', asset: 'USDT', ticketPrice: '', prizeAsset: 'BTC', prizeAmount: '',
    prizeUsd: '', capacity: '400', maxPerUser: '40', days: '6', funded: true,
  });
  useEffect(() => { if (open) setForm({ name: '', subtitle: '', asset: 'USDT', ticketPrice: '', prizeAsset: 'BTC', prizeAmount: '', prizeUsd: '', capacity: '400', maxPerUser: '40', days: '6', funded: true }); }, [open]);

  const num = (s: string) => Number(s);
  const valid = form.name.trim().length >= 3 && num(form.ticketPrice) > 0 && num(form.prizeAmount) > 0 && num(form.prizeUsd) > 0 && num(form.capacity) > 0 && num(form.days) > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const closesAt = new Date(Date.now() + num(form.days) * 86400000).toISOString();
      const { error } = await getClient().rpc('admin_create_pool', {
        p_name: form.name.trim(), p_subtitle: form.subtitle.trim(), p_asset: form.asset,
        p_ticket_price: num(form.ticketPrice), p_prize_asset: form.prizeAsset,
        p_prize_amount: num(form.prizeAmount), p_prize_usd: num(form.prizeUsd),
        p_capacity: Math.floor(num(form.capacity)), p_closes_at: closesAt,
        p_prize_funded: form.funded, p_max_per_user: Math.floor(num(form.maxPerUser)) || 40, p_draw_method: null,
      });
      if (error) throw error;
      push('success', 'Pool published', `"${form.name.trim()}" is now live for members.`);
      onClose();
      await onDone();
    } catch (e) {
      push('error', 'Could not create pool', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create & publish a pool" maxWidth="max-w-xl">
      <div className="space-y-3.5">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[10px] text-amber-100/75 flex gap-2"><Info size={13} className="shrink-0 mt-0.5" />Published pools are visible to every member immediately and open for ticket sales until capacity or deadline.</div>
        <Field label="Pool name"><input className="field" placeholder="Bitcoin Grand Jackpot II" value={form.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Subtitle"><input className="field" placeholder="Weekly flagship draw — verified prize" value={form.subtitle} onChange={set('subtitle')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ticket currency"><select className="field" value={form.asset} onChange={set('asset')}>{['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE'].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Ticket price"><input className="field font-mono" type="number" min="0" step="any" placeholder="25" value={form.ticketPrice} onChange={set('ticketPrice')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prize asset"><select className="field" value={form.prizeAsset} onChange={set('prizeAsset')}>{['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL'].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Prize amount"><input className="field font-mono" type="number" min="0" step="any" placeholder="2.5" value={form.prizeAmount} onChange={set('prizeAmount')} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prize value USD"><input className="field font-mono" type="number" min="0" placeholder="243500" value={form.prizeUsd} onChange={set('prizeUsd')} /></Field>
          <Field label="Capacity"><input className="field font-mono" type="number" min="1" placeholder="400" value={form.capacity} onChange={set('capacity')} /></Field>
          <Field label="Max / member"><input className="field font-mono" type="number" min="1" placeholder="40" value={form.maxPerUser} onChange={set('maxPerUser')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Duration (days)"><input className="field font-mono" type="number" min="0.05" step="any" placeholder="6" value={form.days} onChange={set('days')} /></Field>
          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 px-4 py-3 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-[#e2a62e]" checked={form.funded} onChange={set('funded')} />
            <span className="text-[11px] font-bold text-zinc-300">Prize is treasury-funded<br /><span className="text-[8.5px] text-zinc-600 font-medium">displays the Funded badge</span></span>
          </label>
        </div>
        <DCLButton gold size="lg" className="w-full" disabled={!valid} loading={busy} onClick={submit}><Ticket size={16} />Publish pool</DCLButton>
      </div>
    </Modal>
  );
}
