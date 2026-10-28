import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ShieldCheck, XCircle, ExternalLink, BadgeCheck, Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import type { Deposit, Transaction } from '../../lib/types';
import { fmtCrypto, fmtUsd, fmtCrypto as fc, timeAgo, truncateMiddle } from '../../lib/format';
import { Card, DCLButton, EmptyState, Skeleton, CopyButton } from '../../components/ui';
import { validateAddress } from '../../lib/validation';

export default function AdminDeposits() {
  const { push } = useToast();
  const [deposits, setDeposits] = useState<Deposit[] | null>(null);
  const [filter, setFilter] = useState<'queue' | 'all'>('queue');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const c = getClient();
    const q = c.from('deposits').select('*').order('created_at', { ascending: false }).limit(100);
    const { data, error } = await (filter === 'queue' ? q.in('status', ['pending', 'confirming']) : q);
    if (error) push('error', 'Load failed', friendlyError(error));
    setDeposits((data as Deposit[]) ?? []);
  }, [filter, push]);

  useEffect(() => { load(); }, [load]);

  const decide = async (d: Deposit, approve: boolean) => {
    setBusyId(d.id);
    try {
      const confs = Number(confirmations[d.id] ?? '') || (approve ? d.required_confirmations : 0);
      if (approve && confs < d.required_confirmations) {
        push('error', 'Insufficient confirmations', `Requires ≥ ${d.required_confirmations} confirmations to credit.`);
        return;
      }
      const { data, error } = await getClient().rpc('admin_credit_deposit', { p_deposit_id: d.id, p_confirmations: confs, p_approve: approve });
      if (error) throw error;
      const res = data as { status: string; already_credited?: boolean; usd_value?: number };
      if (approve) {
        push('success', res.already_credited ? 'Already credited (idempotent)' : 'Deposit credited', res.already_credited ? 'This deposit was credited previously — no double credit applied.' : `${fmtCrypto(Number(d.amount))} ${d.asset} credited after ${confs} confirmations${res.usd_value ? ` (${fmtUsd(Number(res.usd_value))})` : ''}. Welcome allocation auto-reviewed.`);
      } else {
        push('info', 'Deposit rejected', 'The member has been notified.');
      }
      await load();
    } catch (e) {
      push('error', 'Verification failed', friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  const explorer = (d: Deposit) => {
    if (d.asset === 'BTC') return `https://www.blockchain.com/explorer/transactions/btc/${d.tx_hash}`;
    if (d.asset === 'ETH' || d.asset === 'USDC' || d.asset === 'BNB') return `https://etherscan.io/tx/${d.tx_hash}`;
    if (d.asset === 'SOL') return `https://solscan.io/tx/${d.tx_hash}`;
    return `https://tronscan.org/#/transaction/${d.tx_hash}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><ArrowDownLeft size={20} className="text-amber-400" />Authorization <span className="gold-text">Desk</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1 max-w-lg">Deposits are credited only after you verify them on-chain. Queued external withdrawals are held here for treasury signing — approve with a broadcast hash, or reject and the member is auto-refunded.</p>
        </div>
        <div className="flex gap-1.5">
          {(['queue', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border ${filter === f ? 'border-amber-500/50 text-amber-200 bg-amber-500/12' : 'border-white/8 text-zinc-500'}`}>{f === 'queue' ? 'Queue' : 'All'}</button>)}
        </div>
      </div>

      {deposits === null && [1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
      {deposits !== null && deposits.length === 0 && <Card><EmptyState icon={<ShieldCheck size={26} />} title={filter === 'queue' ? 'Verification queue is clear' : 'No deposits recorded'} body="Member-submitted transaction hashes appear here for independent on-chain verification." /></Card>}

      <div className="space-y-3">
        {(deposits ?? []).map((d) => {
          const statusColor = d.status === 'credited' ? 'chip-paid' : d.status === 'rejected' ? 'chip-gray' : 'chip-open';
          const actionable = d.status === 'pending' || d.status === 'confirming';
          return (
            <Card key={d.id} sheen className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[16px] font-semibold text-zinc-50">{fmtCrypto(Number(d.amount))} {d.asset}</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-black/50 border border-white/8 text-zinc-400">{d.network}</span>
                    <span className={`chip ${statusColor}`}>{d.status}</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-mono mt-1.5">member {d.user_id.slice(0, 13)}… · submitted {timeAgo(d.created_at)}{d.usd_value ? ` · ≈ ${fmtUsd(Number(d.usd_value))}` : ''}</p>
                  {d.tx_hash && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <code className="font-mono text-[9.5px] text-gold-100/80 bg-black/50 border border-gold-500/20 rounded-lg px-2.5 py-1.5 break-all">{truncateMiddle(d.tx_hash, 22, 18)}</code>
                      <CopyButton value={d.tx_hash} label="Hash" />
                      <a href={explorer(d)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9.5px] font-bold text-sky-300 hover:text-sky-100">View on explorer <ExternalLink size={10} /></a>
                    </div>
                  )}
                  {actionable && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider">
                        Confirmations
                        <input type="number" min={0} className="field !w-20 font-mono !py-1.5 text-center" placeholder={String(d.required_confirmations)} value={confirmations[d.id] ?? ''} onChange={(e) => setConfirmations((p) => ({ ...p, [d.id]: e.target.value }))} />
                        <span className="text-zinc-600">/ {d.required_confirmations} required</span>
                      </label>
                    </div>
                  )}
                </div>
                {actionable && (
                  <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                    <DCLButton gold size="sm" loading={busyId === d.id} onClick={() => decide(d, true)}><BadgeCheck size={13} />Verify &amp; credit</DCLButton>
                    <DCLButton ghost size="sm" className="!border-rose-500/40 !text-rose-300 hover:!bg-rose-500/10" loading={busyId === d.id} onClick={() => decide(d, false)}><XCircle size={13} />Reject</DCLButton>
                  </div>
                )}
                {!actionable && (
                  <div className="flex items-center gap-2 text-[10.5px] font-mono text-zinc-500 shrink-0">
                    {d.status === 'credited' ? <><Clock size={12} />credited {d.credited_at ? timeAgo(d.credited_at) : ''}</> : 'closed'}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ============ QUEUED EXTERNAL WITHDRAWALS ============ */}
      <WithdrawalQueue />
    </div>
  );
}

function WithdrawalQueue() {
  const { push } = useToast();
  const [pending, setPending] = useState<Transaction[] | null>(null);
  const [hashDrafts, setHashDrafts] = useState<Record<string, string>>({});
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getClient()
      .from('transactions').select('*')
      .eq('type', 'withdrawal').eq('status', 'pending').eq('provider', 'treasury-signer')
      .order('created_at', { ascending: true }).limit(50);
    if (error) push('error', 'Queue load failed', friendlyError(error));
    setPending((data as Transaction[]) ?? []);
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const finalize = async (tx: Transaction, approve: boolean) => {
    setBusy(tx.ref);
    try {
      const { error } = await getClient().rpc('admin_finalize_withdrawal', {
        p_ref: tx.ref,
        p_approve: approve,
        p_tx_hash: approve ? (hashDrafts[tx.ref] ?? '').trim() : null,
        p_reason: approve ? null : (reasonDrafts[tx.ref] ?? '').trim(),
      });
      if (error) throw error;
      push('success', approve ? 'Withdrawal completed' : 'Withdrawal rejected — refunded', approve ? `Broadcast hash recorded. Member notified.` : 'Amount + fee returned to the member wallet. Audit adjustment written.');
      await load();
    } catch (e) {
      push('error', 'Finalization failed', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  if (!pending || pending.length === 0) return null;
  return (
    <div className="pt-2">
      <h2 className="font-display text-[13px] uppercase tracking-[0.18em] text-amber-200 flex items-center gap-2 mb-2.5"><ArrowUpRight size={14} />Queued external withdrawals <span className="chip chip-open ml-1">{pending.length}</span></h2>
      <div className="space-y-3">
        {pending.map((tx) => (
          <Card key={tx.id} className="p-4 border-amber-500/25">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] font-semibold text-zinc-100">{fc(Number(tx.amount))} {tx.asset} <span className="text-zinc-600">· fee {fc(Number(tx.fee))}</span></p>
                <p className="text-[9px] text-zinc-500 font-mono mt-1 break-all">{tx.note}</p>
                <p className="text-[8.5px] text-zinc-700 font-mono mt-0.5">{tx.ref} · {timeAgo(tx.created_at)} · member {tx.user_id.slice(0, 12)}…</p>
                <div className="grid sm:grid-cols-2 gap-2 mt-2.5 max-w-xl">
                  <input className="field font-mono !text-[10px] !py-2" placeholder="Broadcast tx hash (to approve)" value={hashDrafts[tx.ref] ?? ''} onChange={(e) => setHashDrafts((p) => ({ ...p, [tx.ref]: e.target.value }))} aria-label="Broadcast hash" />
                  <input className="field !text-[10px] !py-2" placeholder="Rejection reason ≥ 8 chars" value={reasonDrafts[tx.ref] ?? ''} onChange={(e) => setReasonDrafts((p) => ({ ...p, [tx.ref]: e.target.value }))} aria-label="Rejection reason" />
                </div>
              </div>
              <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                <DCLButton gold size="sm" loading={busy === tx.ref} onClick={() => finalize(tx, true)}><CheckCircle2 size={12} />Approve</DCLButton>
                <DCLButton ghost size="sm" className="!border-rose-500/40 !text-rose-300" loading={busy === tx.ref} onClick={() => finalize(tx, false)}><XCircle size={12} />Reject</DCLButton>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
