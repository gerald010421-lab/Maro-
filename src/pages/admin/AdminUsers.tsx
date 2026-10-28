import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users, Scale, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import type { Profile, Wallet, Ticket, Transaction } from '../../lib/types';
import { fmtCrypto, fmtUsd, timeAgo } from '../../lib/format';
import { Card, DCLButton, Avatar, Modal, Field, EmptyState, Skeleton } from '../../components/ui';

interface UserRow extends Profile {
  wallets?: Wallet[];
  ticketCount?: number;
  expanded?: boolean;
  recentTx?: Transaction[];
  recentTickets?: Ticket[];
}

export default function AdminUsers() {
  const { push } = useToast();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    const c = getClient();
    const [{ data: profiles }, { data: wallets }, { data: tickets }] = await Promise.all([
      c.from('profiles').select('*').order('created_at', { ascending: false }).limit(300),
      c.from('wallets').select('*'),
      c.from('tickets').select('user_id'),
    ]);
    const walletMap = new Map<string, Wallet[]>();
    for (const w of (wallets as Wallet[]) ?? []) {
      const list = walletMap.get(w.user_id) ?? [];
      list.push(w);
      walletMap.set(w.user_id, list);
    }
    const ticketCount = new Map<string, number>();
    for (const t of (tickets as Array<{ user_id: string }>) ?? []) ticketCount.set(t.user_id, (ticketCount.get(t.user_id) ?? 0) + 1);
    setRows(((profiles as Profile[]) ?? []).map((p) => ({ ...p, wallets: walletMap.get(p.id) ?? [], ticketCount: ticketCount.get(p.id) ?? 0 })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.email, r.username ?? '', r.full_name ?? ''].some((s) => s.toLowerCase().includes(q)));
  }, [rows, query]);

  const toggleExpand = async (row: UserRow) => {
    const c = getClient();
    if (row.expanded) { setRows((rs) => rs?.map((r) => r.id === row.id ? { ...r, expanded: false } : r) ?? null); return; }
    const [{ data: tx }, { data: tk }] = await Promise.all([
      c.from('transactions').select('*').eq('user_id', row.id).order('created_at', { ascending: false }).limit(6),
      c.from('tickets').select('*').eq('user_id', row.id).order('created_at', { ascending: false }).limit(6),
    ]);
    setRows((rs) => rs?.map((r) => r.id === row.id ? { ...r, expanded: true, recentTx: (tx as Transaction[]) ?? [], recentTickets: (tk as Ticket[]) ?? [] } : r) ?? null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><Users size={20} className="text-amber-400" />Member <span className="gold-text">Directory</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1">{rows?.length ?? '…'} registered accounts · search, inspect, and adjust with a full audit trail.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input className="field !pl-10" placeholder="Search email, name, username…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
        </div>
      </div>

      {rows === null && <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>}
      {rows !== null && filtered.length === 0 && <Card><EmptyState icon={<Search size={24} />} title="No member matches" body="Adjust your search — matching is case-insensitive across email, name and username." /></Card>}

      <div className="space-y-2">
        {filtered.map((r) => {
          const usd = (r.wallets ?? []).reduce((s, w) => s + Number(w.available) * Number(w.usd_rate || 0) + Number(w.locked) * Number(w.usd_rate || 0), 0);
          return (
            <Card key={r.id} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar name={r.full_name || r.email} color={r.avatar_color} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-bold text-zinc-100 truncate">{r.full_name || '—'}</p>
                    {r.role === 'admin' && <span className="chip chip-admin !text-[7px]">ADMIN</span>}
                  </div>
                  <p className="text-[9.5px] text-zinc-500 font-mono truncate">{r.email}{r.username ? ` · @${r.username}` : ''}</p>
                </div>
                <div className="hidden md:block text-right">
                  <p className="font-mono text-[11.5px] text-zinc-200">{fmtUsd(usd)}</p>
                  <p className="text-[8.5px] text-zinc-600 font-mono">{r.ticketCount} ticket(s)</p>
                </div>
                <button onClick={() => setAdjustTarget(r)} className="btn-ghost-gold rounded-lg px-2.5 py-2 text-[10px] inline-flex items-center gap-1.5" title="Adjust balance (ledgered)"><Scale size={12} /><span className="hidden sm:inline">Adjust</span></button>
                <button onClick={() => toggleExpand(r)} className="p-2 text-zinc-500 hover:text-zinc-100" aria-label={r.expanded ? 'Collapse' : 'Expand'}>
                  {r.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {r.expanded && (
                <div className="border-t border-white/6 bg-black/35 px-4 sm:px-5 py-4 grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-extrabold mb-1.5">Wallet balances</p>
                    <div className="space-y-1">
                      {(r.wallets ?? []).length === 0 && <p className="text-[10px] text-zinc-600">No wallet rows</p>}
                      {(r.wallets ?? []).map((w) => (
                        <div key={w.id} className="flex justify-between text-[10.5px] font-mono"><span className="text-zinc-400">{w.asset}</span><span className="text-zinc-200">{fmtCrypto(Number(w.available))} avail{Number(w.locked) > 0 && <span className="text-gold-400"> · {fmtCrypto(Number(w.locked))} locked</span>}</span></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-extrabold mb-1.5">Latest ledger entries</p>
                    <div className="space-y-1">
                      {(r.recentTx ?? []).slice(0, 5).map((t) => (
                        <div key={t.id} className="flex justify-between gap-2 text-[9.5px] font-mono"><span className="text-zinc-500 truncate">{t.type} · {timeAgo(t.created_at)}</span><span className={t.direction === 'credit' ? 'text-emerald-400' : 'text-zinc-400'}>{t.direction === 'credit' ? '+' : '−'}{fmtCrypto(Number(t.amount))} {t.asset}</span></div>
                      ))}
                      {(r.recentTx ?? []).length === 0 && <p className="text-[10px] text-zinc-600">No transactions</p>}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <AdjustModal target={adjustTarget} onClose={() => setAdjustTarget(null)} onDone={load} />
    </div>
  );
}

function AdjustModal({ target, onClose, onDone }: { target: UserRow | null; onClose: () => void; onDone: () => Promise<void> }) {
  const { push } = useToast();
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (target) { setAsset('USDT'); setAmount(''); setReason(''); } }, [target]);

  const amountNum = Number(amount);
  const valid = amount !== '' && Number.isFinite(amountNum) && amountNum !== 0 && reason.trim().length >= 8;

  const submit = async () => {
    if (!target || !valid) return;
    setBusy(true);
    try {
      const { data, error } = await getClient().rpc('admin_adjust_balance', {
        p_user_id: target.id, p_asset: asset, p_amount: amountNum, p_reason: reason.trim(),
      });
      if (error) throw error;
      const res = data as { ref: string; new_balance: number };
      push('success', 'Balance adjusted — ledgered', `${amountNum >= 0 ? '+' : ''}${amountNum} ${asset} for ${target.email} · new balance ${fmtCrypto(Number(res.new_balance))} · ref ${res.ref}`);
      onClose();
      await onDone();
    } catch (e) {
      push('error', 'Adjustment failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title="Audited balance adjustment">
      {target && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/6 px-4 py-3 text-[11px] text-amber-100/85">
            Adjusting <span className="font-bold text-amber-100">{target.full_name || target.email}</span>. This writes an <span className="font-bold">append-only audit row</span> (asset, amount, reason, administrator, timestamp, reference) and a matching transaction. Positive amounts credit, negative debit. Debits beyond available balance are rejected.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset">
              <select className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>{['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE'].map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Amount (+credit / −debit)">
              <input className="field font-mono" type="number" step="any" placeholder="e.g. 250 or -0.5" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </Field>
          </div>
          <Field label="Reason (min 8 chars — permanently archived)" id="adj-reason">
            <textarea className="field min-h-[72px]" placeholder="e.g. Compensation for issue #4821 — prize pool migration" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DCLButton gold className="w-full" loading={busy} disabled={!valid} onClick={submit}><Scale size={15} />Commit adjustment to ledger</DCLButton>
        </div>
      )}
    </Modal>
  );
}
