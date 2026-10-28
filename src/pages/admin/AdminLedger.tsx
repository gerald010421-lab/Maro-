import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Download, Scale } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import type { Adjustment, Transaction } from '../../lib/types';
import { fmtCrypto, timeAgo } from '../../lib/format';
import { Card, DCLButton, EmptyState, Skeleton } from '../../components/ui';

type Tab = 'transactions' | 'adjustments';

export default function AdminLedger() {
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('transactions');
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[] | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const load = useCallback(async () => {
    const c = getClient();
    const [t, a] = await Promise.all([
      c.from('transactions').select('*').order('created_at', { ascending: false }).limit(150),
      c.from('adjustments').select('*').order('created_at', { ascending: false }).limit(150),
    ]);
    if (t.error) push('error', 'Ledger load failed', friendlyError(t.error));
    setTransactions((t.data as Transaction[]) ?? []);
    setAdjustments((a.data as Adjustment[]) ?? []);
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const txTypes = ['all', ...Array.from(new Set((transactions ?? []).map((t) => t.type)))];
  const shownTx = (transactions ?? []).filter((t) => typeFilter === 'all' || t.type === typeFilter);

  const exportCsv = () => {
    const rows = tab === 'transactions'
      ? ['ref,type,direction,asset,amount,counter,status,provider,created_at,note',
         ...shownTx.map((t) => [t.ref, t.type, t.direction, t.asset, t.amount, t.counter_asset ? `${t.counter_amount} ${t.counter_asset}` : '', t.status, t.provider, t.created_at, `"${t.note.replace(/"/g, '""')}"`].join(','))]
      : ['ref,user_id,asset,amount,reason,actor_email,created_at',
         ...(adjustments ?? []).map((a) => [a.ref, a.user_id, a.asset, a.amount, `"${a.reason.replace(/"/g, '""')}"`, a.actor_email ?? '', a.created_at].join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `dcl-ledger-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
    push('success', 'Ledger exported', `${rows.length - 1} rows written to CSV.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><ScrollText size={20} className="text-amber-400" />Audit <span className="gold-text">Ledger</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1 max-w-lg">Append-only record of every financial movement and every administrative intervention. Rows cannot be edited or deleted — only added.</p>
        </div>
        <DCLButton ghost size="sm" onClick={exportCsv}><Download size={13} />Export CSV</DCLButton>
      </div>

      <div className="flex gap-1.5">
        {(['transactions', 'adjustments'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border inline-flex items-center gap-2 ${tab === t ? 'border-amber-500/50 text-amber-200 bg-amber-500/12' : 'border-white/8 text-zinc-500'}`}>
            {t === 'adjustments' && <Scale size={12} />}{t}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {txTypes.map((t) => <button key={t} onClick={() => setTypeFilter(t)} className={`whitespace-nowrap text-[9.5px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${typeFilter === t ? 'border-gold-500/50 text-gold-200 bg-gold-500/10' : 'border-white/8 text-zinc-500'}`}>{t.replace(/_/g, ' ')}</button>)}
          </div>
          {transactions === null ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />) : shownTx.length === 0 ? (
            <Card><EmptyState icon={<ScrollText size={24} />} title="Nothing in this slice" body="Financial events will appear here as members interact with the platform." /></Card>
          ) : (
            <Card className="divide-y divide-white/5 overflow-hidden">
              {shownTx.map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[130px_1fr_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-gold-500/4 text-[10.5px]">
                  <span className="font-mono text-[9px] text-zinc-500 truncate">{t.ref}</span>
                  <span className="text-zinc-300 truncate col-span-2 sm:col-span-1"><span className="capitalize font-semibold">{t.type.replace(/_/g, ' ')}</span> <span className="text-zinc-600 hidden md:inline">· {t.note.slice(0, 80)}</span></span>
                  <span className={`font-mono font-semibold ${t.direction === 'credit' ? 'text-emerald-300' : 'text-zinc-300'}`}>{t.direction === 'credit' ? '+' : '−'}{fmtCrypto(Number(t.amount))} {t.asset}</span>
                  <span className="text-[8.5px] text-zinc-600 font-mono hidden sm:block">{timeAgo(t.created_at)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'adjustments' && (
        adjustments === null ? [1, 2].map((i) => <Skeleton key={i} className="h-14" />) : adjustments.length === 0 ? (
          <Card><EmptyState icon={<Scale size={24} />} title="No manual adjustments" body="Administrative balance changes will be permanently recorded here with reason and actor." /></Card>
        ) : (
          <Card className="divide-y divide-white/5 overflow-hidden">
            {adjustments.map((a) => (
              <div key={a.id} className="px-4 sm:px-5 py-3 hover:bg-gold-500/4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[9px] text-zinc-500">{a.ref}</span>
                  <span className={`font-mono text-[11.5px] font-semibold ${Number(a.amount) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Number(a.amount) >= 0 ? '+' : ''}{fmtCrypto(Number(a.amount))} {a.asset}</span>
                  <span className="text-[9px] text-zinc-600 font-mono ml-auto">{timeAgo(a.created_at)}</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-1">{a.reason}</p>
                <p className="text-[8.5px] text-zinc-600 font-mono mt-0.5">target {a.user_id.slice(0, 12)}… · actor {a.actor_email ?? a.actor_id.slice(0, 12)}</p>
              </div>
            ))}
          </Card>
        )
      )}
    </div>
  );
}
