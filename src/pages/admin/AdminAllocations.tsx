import { useCallback, useEffect, useState } from 'react';
import { Coins, Lock, Unlock, BadgeCheck } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import type { WelcomeAllocation, Profile } from '../../lib/types';
import { fmtCrypto, fmtUsd, timeAgo } from '../../lib/format';
import { Card, DCLButton, Modal, Field, EmptyState, Skeleton } from '../../components/ui';

interface Row extends WelcomeAllocation { profile?: Profile | null }

export default function AdminAllocations() {
  const { push } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<'locked' | 'unlocked' | 'all'>('locked');
  const [target, setTarget] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const c = getClient();
    const q = c.from('welcome_allocations').select('*').order('created_at', { ascending: false });
    const { data, error } = await (filter === 'all' ? q : q.eq('status', filter));
    if (error) { push('error', 'Load failed', friendlyError(error)); setRows([]); return; }
    const allocs = (data as WelcomeAllocation[]) ?? [];
    const uids = allocs.map((a) => a.user_id);
    let profiles: Profile[] = [];
    if (uids.length) {
      const { data: p } = await c.from('profiles').select('*').in('id', uids);
      profiles = (p as Profile[]) ?? [];
    }
    setRows(allocs.map((a) => ({ ...a, profile: profiles.find((p) => p.id === a.user_id) ?? null })));
  }, [filter, push]);
  useEffect(() => { load(); }, [load]);

  const lockedCount = (rows ?? []).filter((r) => r.status === 'locked').length;
  const lockedBtc = (rows ?? []).filter((r) => r.status === 'locked').reduce((s, r) => s + Number(r.btc_amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><Coins size={20} className="text-amber-400" />Welcome <span className="gold-text">Allocations</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1 max-w-lg">$80,000 per eligible account, auto-converted to BTC and locked. Releases happen automatically when a qualifying deposit is verified — manual release requires a permanent audited reason.</p>
        </div>
        <div className="flex items-center gap-2">
          {(['locked', 'unlocked', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3.5 py-2 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider border ${filter === f ? 'border-amber-500/50 text-amber-200 bg-amber-500/12' : 'border-white/8 text-zinc-500'}`}>{f}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Card className="p-4 text-center"><Lock size={15} className="text-gold-400 mx-auto mb-1" /><div className="font-mono text-lg text-gold-200 font-semibold">{lockedCount}</div><div className="text-[8.5px] uppercase tracking-wider text-zinc-500 font-bold">locked allocations</div></Card>
        <Card className="p-4 text-center"><Coins size={15} className="text-gold-400 mx-auto mb-1" /><div className="font-mono text-lg text-gold-200 font-semibold">{fmtCrypto(lockedBtc)} BTC</div><div className="text-[8.5px] uppercase tracking-wider text-zinc-500 font-bold">locked value</div></Card>
      </div>

      {rows === null && [1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      {rows !== null && rows.length === 0 && <Card><EmptyState icon={<Coins size={24} />} title={`No ${filter} allocations`} body="Claims appear here the moment a member first converts their welcome balance." /></Card>}

      <div className="space-y-2.5">
        {(rows ?? []).map((r) => (
          <Card key={r.id} className="p-4 flex flex-wrap items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.status === 'locked' ? 'bg-gold-500/10 text-gold-400' : 'bg-emerald-400/10 text-emerald-400'}`}>{r.status === 'locked' ? <Lock size={17} /> : <BadgeCheck size={17} />}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-zinc-100 truncate">{r.profile?.full_name || r.profile?.email || r.user_id.slice(0, 12)}</p>
              <p className="text-[9px] text-zinc-600 font-mono truncate">{r.profile?.email} · claimed {timeAgo(r.created_at)} · ref {r.conversion_ref}</p>
              <p className="text-[9.5px] font-mono text-zinc-400 mt-1">{fmtCrypto(Number(r.btc_amount))} BTC <span className="text-zinc-600">@ ${Number(r.rate).toLocaleString()} · fee ${Number(r.fee_usd)}</span>{r.status === 'unlocked' && r.unlocked_at && <span className="text-emerald-400"> · unlocked {timeAgo(r.unlocked_at)}</span>}</p>
            </div>
            {r.status === 'locked' && <DCLButton ghost size="sm" onClick={() => setTarget(r)}><Unlock size={12} />Manual release</DCLButton>}
          </Card>
        ))}
      </div>

      <ReleaseModal target={target} onClose={() => setTarget(null)} onDone={load} />
    </div>
  );
}

function ReleaseModal({ target, onClose, onDone }: { target: Row | null; onClose: () => void; onDone: () => Promise<void> }) {
  const { push } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (target) setReason(''); }, [target]);

  const valid = reason.trim().length >= 8;
  const submit = async () => {
    if (!target || !valid) return;
    setBusy(true);
    try {
      const { error } = await getClient().rpc('admin_release_allocation', { p_user_id: target.user_id, p_reason: reason.trim() });
      if (error) throw error;
      push('gold', 'Allocation released', `${fmtCrypto(Number(target.btc_amount))} BTC moved to available for ${target.profile?.email}. Audit row written.`);
      onClose();
      await onDone();
    } catch (e) {
      push('error', 'Release failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title="Manual allocation release">
      {target && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/6 px-4 py-3 text-[11px] text-amber-100/85 leading-relaxed">
            Releasing <span className="font-bold text-amber-100">{fmtCrypto(Number(target.btc_amount))} BTC</span> for <span className="font-bold text-amber-100">{target.profile?.email}</span> without an on-chain qualifying deposit. This bypasses the standard verification path and is recorded as an audited adjustment with your administrator identity. Use only for documented treasury exceptions.
          </div>
          <Field label="Reason (min 8 chars — archived permanently)" id="release-reason">
            <textarea className="field min-h-[84px]" placeholder="e.g. Qualifying deposit verified via alternate custody channel — ticket #4821" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <DCLButton gold size="lg" className="w-full" disabled={!valid} loading={busy} onClick={submit}><Unlock size={15} />Release and ledger</DCLButton>
        </div>
      )}
    </Modal>
  );
}
