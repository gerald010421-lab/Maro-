import { useCallback, useEffect, useState } from 'react';
import { Landmark, Plus, Pencil, EyeOff, Eye, AlertTriangle, Radio } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import type { PlatformAddress } from '../../lib/types';
import { timeAgo, truncateMiddle } from '../../lib/format';
import { validateAddress, requiresMemo } from '../../lib/validation';
import { Card, DCLButton, Modal, Field, EmptyState, Skeleton, CopyButton } from '../../components/ui';
import { AssetIcon } from '../../lib/cryptoAssets';

const BLANK = { title: '', purpose: '', asset: 'BTC', network: 'Bitcoin', address: '', memo: '', instructions: '' };
const NETWORKS: Record<string, string[]> = {
  BTC: ['Bitcoin'], ETH: ['ERC-20'], USDT: ['TRC-20', 'ERC-20'], USDC: ['ERC-20'], BNB: ['BEP-20'], SOL: ['Solana'], XRP: ['Ripple'], DOGE: ['Dogecoin'],
};

export default function AdminAddresses() {
  const { push } = useToast();
  const [addresses, setAddresses] = useState<PlatformAddress[] | null>(null);
  const [editing, setEditing] = useState<PlatformAddress | 'new' | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getClient().from('platform_addresses').select('*').order('status', { ascending: true }).order('updated_at', { ascending: false });
    if (error) push('error', 'Load failed', friendlyError(error));
    setAddresses((data as PlatformAddress[]) ?? []);
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (a: PlatformAddress) => {
    const next = a.status === 'active' ? 'inactive' : 'active';
    const { error } = await getClient().from('platform_addresses').update({ status: next }).eq('id', a.id);
    if (error) { push('error', 'Update failed', friendlyError(error)); return; }
    push('gold', next === 'active' ? 'Address live — broadcasting to all members' : 'Address deactivated', next === 'active' ? 'Every member wallet now shows this address in real time.' : 'Members no longer see this address. Rotation complete.');
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><Landmark size={20} className="text-amber-400" />Payment <span className="gold-text">Addresses &amp; Broadcasts</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1 max-w-lg">The single source of truth for platform deposit destinations. Edits sync to every member wallet in real time via Postgres realtime — no deploy, no refresh.</p>
        </div>
        <DCLButton gold onClick={() => setEditing('new')}><Plus size={15} />New address</DCLButton>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-[10.5px] text-amber-100/80 flex items-start gap-2"><Radio size={13} className="shrink-0 mt-0.5" />Addresses broadcast instantly. Publishing requires explicit confirmation of asset, network and the complete address string — a mistyped character becomes every member's lost funds.</div>

      {addresses === null && [1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
      {addresses !== null && addresses.length === 0 && <Card><EmptyState icon={<Landmark size={26} />} title="No addresses published" body="Publish your first treasury deposit address — members will see it instantly in Wallet → Official Payment Addresses." /></Card>}

      <div className="grid xl:grid-cols-2 gap-4">
        {(addresses ?? []).map((a) => (
          <Card key={a.id} sheen className={`p-5 flex flex-col gap-2.5 ${a.status === 'inactive' ? 'opacity-60' : 'border-amber-500/25'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <AssetIcon symbol={a.asset} size={36} />
                <div className="min-w-0">
                  <h2 className="text-[13px] font-extrabold text-zinc-50 leading-tight truncate">{a.title}</h2>
                  <p className="text-[8.5px] text-zinc-500 font-mono mt-0.5">{a.purpose || 'General treasury intake'}</p>
                </div>
              </div>
              <span className={`chip shrink-0 ${a.status === 'active' ? 'chip-live' : 'chip-gray'}`}>{a.status}</span>
            </div>
            <div className="text-[9.5px] font-mono text-zinc-500">{a.asset} · {a.network} · updated {timeAgo(a.updated_at)} by {a.updated_by ? 'treasury' : 'system'}</div>
            <div className="rounded-xl border border-white/8 bg-black/55 p-2.5 flex items-center gap-2">
              <p className="font-mono text-[10px] text-gold-100/90 break-all flex-1 select-all">{truncateMiddle(a.address, 18, 16)}</p>
              <CopyButton value={a.address} label="Address" />
            </div>
            {a.memo && <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5 flex items-center gap-2"><p className="font-mono text-[10.5px] text-amber-200 flex-1 select-all">memo: {a.memo}</p><CopyButton value={a.memo} label="Memo" /></div>}
            <div className="flex gap-2 mt-auto pt-1">
              <DCLButton ghost size="sm" className="flex-1" onClick={() => setEditing(a)}><Pencil size={12} />Edit / replace</DCLButton>
              <DCLButton ghost size="sm" className="flex-1" onClick={() => toggleStatus(a)}>{a.status === 'active' ? <><EyeOff size={12} />Deactivate</> : <><Eye size={12} />Reactivate</>}</DCLButton>
            </div>
          </Card>
        ))}
      </div>

      <AddressEditor target={editing} onClose={() => setEditing(null)} onDone={load} />
    </div>
  );
}

function AddressEditor({ target, onClose, onDone }: { target: PlatformAddress | 'new' | null; onClose: () => void; onDone: () => Promise<void> }) {
  const isNew = target === 'new';
  const { push } = useToast();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (target === 'new') setForm(BLANK);
    else if (target) setForm({ title: target.title, purpose: target.purpose, asset: target.asset, network: target.network, address: target.address, memo: target.memo ?? '', instructions: target.instructions });
    setConfirmed(false);
  }, [target]);

  const networks = NETWORKS[form.asset] ?? ['Bitcoin'];
  useEffect(() => { if (!networks.includes(form.network)) setForm((f) => ({ ...f, network: networks[0] })); }, [form.asset]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = validateAddress(form.asset, form.network, form.address);
  const memoInfo = requiresMemo(form.asset, form.network);
  const memoOk = !memoInfo.required || form.memo.trim().length > 0;
  const valid = form.title.trim().length >= 3 && check.ok && memoOk && form.instructions.trim().length >= 4 && confirmed;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = { title: form.title.trim(), purpose: form.purpose.trim(), asset: form.asset, network: form.network, address: form.address.trim(), memo: form.memo.trim() || null, instructions: form.instructions.trim(), status: 'active' as const };
      const { error } = isNew
        ? await getClient().from('platform_addresses').insert(payload)
        : await getClient().from('platform_addresses').update(payload).eq('id', (target as PlatformAddress).id);
      if (error) throw error;
      push('gold', isNew ? 'Address published' : 'Address replaced', 'Broadcasting to every member wallet right now.');
      onClose();
      await onDone();
    } catch (e) {
      push('error', 'Save failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title={isNew ? 'Publish payment address' : 'Replace address'} maxWidth="max-w-xl">
      <div className="space-y-3.5">
        <Field label="Title (shown to members)"><input className="field" placeholder="Treasury Intake — Qualifying Funding" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
        <Field label="Purpose"><input className="field" placeholder="Welcome-unlock qualifying deposits" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset"><select className="field" value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>{Object.keys(NETWORKS).map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Network"><select className="field" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}>{networks.map((n) => <option key={n}>{n}</option>)}</select></Field>
        </div>
        <Field label="Full address" id="addr-full">
          <textarea className="field font-mono !text-[11px] min-h-[64px] break-all" placeholder="Paste the complete address — every character matters" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} spellCheck={false} autoComplete="off" />
          {form.address && <p className={`mt-1.5 text-[10px] flex items-center gap-1 ${check.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{check.ok ? '✓' : '⚠'}{check.message}</p>}
        </Field>
        <Field label={memoInfo.required ? 'Memo / tag (REQUIRED for this network)' : 'Memo / tag (optional)'} id="addr-memo">
          <input className="field font-mono" placeholder={memoInfo.required ? 'Destination tag — required' : 'Leave empty if none'} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        </Field>
        <Field label="Instructions for members"><textarea className="field min-h-[72px]" placeholder="Minimum $500 equivalent. Deposits are verified on-chain within 1–3 hours. Memo required or funds are stranded." value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>

        <label className="flex items-start gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/8 px-3.5 py-3 cursor-pointer select-none">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#e2a62e]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span className="text-[10.5px] text-amber-100/90 leading-snug"><AlertTriangle size={11} className="inline mr-1" />I confirm the <span className="font-bold">asset ({form.asset})</span>, <span className="font-bold">network ({form.network})</span> and the <span className="font-bold">complete address</span> above character-for-character. I understand this publishes to every member instantly.</span>
        </label>
        <DCLButton gold size="lg" className="w-full" disabled={!valid} loading={busy} onClick={submit}><Landmark size={15} />{isNew ? 'Publish address' : 'Replace address'} — broadcast now</DCLButton>
      </div>
    </Modal>
  );
}
