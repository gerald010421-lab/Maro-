import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet as WalletIcon, Lock, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Landmark,
  ShieldCheck, CheckCircle2, AlertTriangle, Info, ChevronRight, ExternalLink, Loader2,
  BadgeCheck, CircleDollarSign, Hourglass, ReceiptText, Tag, ListFilter, X,
} from 'lucide-react';
import { useAuth, usePrices, useToast } from '../lib/context';
import { getClient, friendlyError } from '../lib/supabase';
import type { Wallet, Asset, PlatformAddress, Deposit, Transaction, WelcomeAllocation } from '../lib/types';
import { fmtCrypto, fmtUsd, timeAgo, truncateMiddle } from '../lib/format';
import { validateAddress, requiresMemo, validateTxHash } from '../lib/validation';
import { Card, DCLButton, CopyButton, Modal, Skeleton, EmptyState, Stat } from '../components/ui';
import { AssetIcon } from '../lib/cryptoAssets';

type Tab = 'overview' | 'official' | 'deposit' | 'send' | 'swap' | 'activity';
const TABS: Array<{ id: Tab; label: string; icon: typeof WalletIcon }> = [
  { id: 'overview', label: 'Overview', icon: WalletIcon },
  { id: 'official', label: 'Official Payment Addresses', icon: Landmark },
  { id: 'deposit', label: 'Deposit', icon: ArrowDownLeft },
  { id: 'send', label: 'Send', icon: ArrowUpRight },
  { id: 'swap', label: 'Swap', icon: ArrowLeftRight },
  { id: 'activity', label: 'Activity', icon: ReceiptText },
];

export default function WalletPage() {
  const { userId } = useAuth();
  const { prices, live, refresh: refreshPrices } = usePrices();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t });

  const [wallets, setWallets] = useState<Wallet[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [addresses, setAddresses] = useState<PlatformAddress[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [allocation, setAllocation] = useState<WelcomeAllocation | null>(null);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const c = getClient();
    const [w, a, ad, d, t, wa] = await Promise.all([
      c.from('wallets').select('*').eq('user_id', userId),
      c.from('assets').select('*').eq('is_enabled', true).order('sort_order'),
      c.from('platform_addresses').select('*').eq('status', 'active').order('updated_at', { ascending: false }),
      c.from('deposits').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      c.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      c.from('welcome_allocations').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setWallets((w.data as Wallet[]) ?? []);
    setAssets((a.data as Asset[]) ?? []);
    setAddresses((ad.data as PlatformAddress[]) ?? []);
    setDeposits((d.data as Deposit[]) ?? []);
    setTxs((t.data as Transaction[]) ?? []);
    setAllocation((wa.data as WelcomeAllocation | null) ?? null);
  }, [userId]);

  useEffect(() => {
    loadAll();
    if (!userId) return;
    const c = getClient();
    // real-time: platform address broadcasts, own deposits & wallet movements
    const ch = c.channel('wallet-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_addresses' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits', filter: `user_id=eq.${userId}` }, loadAll)
      .subscribe();
    return () => { c.removeChannel(ch); };
  }, [loadAll, userId]);

  const rateOf = useCallback((sym: string) => prices[sym]?.usd ?? (sym === 'USDT' || sym === 'USDC' ? 1 : 0), [prices]);

  const totals = useMemo(() => {
    if (!wallets) return { avail: 0, locked: 0 };
    let avail = 0, locked = 0;
    for (const w of wallets) { avail += Number(w.available) * rateOf(w.asset); locked += Number(w.locked) * rateOf(w.asset); }
    return { avail, locked };
  }, [wallets, rateOf]);

  const lockedBtc = wallets?.find((w) => w.asset === 'BTC')?.locked ?? 0;
  const pendingDepositsUsd = deposits.filter((d) => d.status === 'pending' || d.status === 'confirming')
    .reduce((s, d) => s + Number(d.amount) * rateOf(d.asset), 0);

  return (
    <div className="space-y-5">
      {/* header + total */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold"><WalletIcon size={12} />Treasury Wallet</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-50 mt-1">Your <span className="gold-text">Vault</span></h1>
        </div>
        <div className="flex items-center gap-2 text-[9.5px] font-mono text-zinc-600">
          {live ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Live oracle · CoinGecko</> : <><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Cached rates — oracle unreachable</>}
          <button onClick={refreshPrices} className="underline hover:text-zinc-300">refresh</button>
        </div>
      </div>

      {/* hero balance band */}
      <Card sheen className="p-5 sm:p-6 border-gold-500/30">
        <div className="grid md:grid-cols-[1.2fr_1fr_1fr_1fr] gap-5 items-center">
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold">Total available</div>
            <div className="font-mono text-[34px] sm:text-[40px] leading-none font-semibold gold-text mt-1.5">{fmtUsd(totals.avail)}</div>
            {totals.locked > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gold-300/90 font-bold"><Lock size={11} />{fmtUsd(totals.locked)} in locked welcome BTC</div>
            )}
          </div>
          <Stat label="Locked (Welcome)" value={`${fmtCrypto(Number(lockedBtc))} BTC`} sub={totals.locked > 0 ? `≈ ${fmtUsd(totals.locked)}` : 'None locked'} tone={totals.locked > 0 ? 'gold' : 'zinc'} />
          <Stat label="Pending deposits" value={fmtUsd(pendingDepositsUsd)} sub={`${deposits.filter((d) => d.status === 'pending' || d.status === 'confirming').length} awaiting verification`} tone={pendingDepositsUsd > 0 ? 'gold' : 'zinc'} />
          <Stat label="Total tracked" value={fmtUsd(totals.avail + totals.locked)} sub="available + locked" tone="zinc" />
        </div>
      </Card>

      {/* tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" role="tablist" aria-label="Wallet sections">
        {TABS.map(({ id, label, icon: I }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 rounded-xl text-[11px] font-extrabold border transition-all ${tab === id ? 'border-gold-500/55 text-gold-100 bg-gold-500/14 shadow-[0_0_18px_-6px_rgba(226,166,46,0.4)]' : 'border-white/8 text-zinc-500 hover:text-zinc-100'}`}>
            <I size={13} />{label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab wallets={wallets} assets={assets} rateOf={rateOf} allocation={allocation} totals={totals} onGoDeposit={() => setTab('deposit')} onGoOfficial={() => setTab('official')} />}
      {tab === 'official' && <OfficialTab addresses={addresses} onDeposit={() => setTab('deposit')} />}
      {tab === 'deposit' && <DepositTab addresses={addresses} deposits={deposits} assets={assets} onDone={loadAll} />}
      {tab === 'send' && <SendTab wallets={wallets} assets={assets} rateOf={rateOf} onDone={loadAll} />}
      {tab === 'swap' && <SwapTab wallets={wallets} assets={assets} prices={prices} onDone={loadAll} />}
      {tab === 'activity' && <ActivityTab txs={txs} />}
    </div>
  );
}

/* ================= OVERVIEW ================= */
function OverviewTab({ wallets, assets, rateOf, allocation, totals, onGoDeposit, onGoOfficial }: {
  wallets: Wallet[] | null; assets: Asset[]; rateOf: (s: string) => number;
  allocation: WelcomeAllocation | null; totals: { avail: number; locked: number };
  onGoDeposit: () => void; onGoOfficial: () => void;
}) {
  const sorted = useMemo(() => {
    if (!wallets) return [];
    const map = new Map(assets.map((a) => [a.symbol, a]));
    return [...wallets].sort((a, b) => (map.get(a.asset)?.sort_order ?? 99) - (map.get(b.asset)?.sort_order ?? 99));
  }, [wallets, assets]);

  return (
    <div className="space-y-5">
      {/* welcome allocation card */}
      {allocation ? (
        <Card sheen className={`p-5 sm:p-6 ${allocation.status === 'locked' ? 'border-gold-500/40' : 'border-emerald-400/30'}`}>
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative shrink-0">
              {allocation.status === 'locked'
                ? <img src="/assets/coin-locked.png" alt="Welcome BTC locked in vault" className="w-24 sm:w-28" />
                : <img src="/assets/coin-hero.png" alt="Welcome BTC unlocked" className="w-24 sm:w-28" />}
            </div>
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`chip ${allocation.status === 'locked' ? 'chip-open' : 'chip-paid'}`}>{allocation.status === 'locked' ? <><Lock size={9} />Locked</> : <><BadgeCheck size={9} />Unlocked</>}</span>
                <span className="text-[9px] font-mono text-zinc-600">ref {allocation.conversion_ref}</span>
              </div>
              <h2 className="font-display text-lg sm:text-xl text-zinc-50 mt-2">Welcome Allocation <span className="gold-text">$80,000 → {fmtCrypto(Number(allocation.btc_amount))} BTC</span></h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[10px]">
                {[
                  ['Allocated', '$80,000'],
                  ['Conversion rate', `$${Number(allocation.rate).toLocaleString()}`],
                  ['Fee', `$${Number(allocation.fee_usd).toFixed(2)}`],
                  ['BTC received', fmtCrypto(Number(allocation.btc_amount))],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/6 bg-black/40 px-3 py-2">
                    <div className="text-[8.5px] uppercase tracking-[0.15em] text-zinc-600 font-bold">{k}</div>
                    <div className="font-mono text-[11px] text-gold-100 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              {allocation.status === 'locked' && (
                <div className="mt-3">
                  <p className="text-[11px] text-zinc-400 leading-snug"><span className="text-gold-300 font-bold">Qualification requirement:</span> deposit ≥ ${Number(allocation.unlock_requirement_usd).toLocaleString()} to any official platform address, then submit the transaction hash under <button onClick={onGoDeposit} className="underline hover:text-gold-100">Deposit</button>. The treasury verifies on-chain — your BTC then unlocks automatically.</p>
                  <DCLButton gold size="sm" className="mt-2.5" onClick={onGoOfficial}><Landmark size={12} />View official payment addresses <ChevronRight size={11} /></DCLButton>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 border-white/8 flex items-center gap-4">
          <Hourglass size={20} className="text-zinc-600 shrink-0" />
          <p className="text-[12px] text-zinc-500">No welcome allocation on this account. If you recently registered, claim it from your <span className="text-gold-300 font-bold">Dashboard</span> — one allocation per member, forever.</p>
        </Card>
      )}

      {/* assets */}
      <div>
        <h3 className="font-display text-[13px] uppercase tracking-[0.15em] text-zinc-500 mb-2">Holdings</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {wallets === null && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          {sorted.map((w) => {
            const a = assets.find((x) => x.symbol === w.asset);
            const rate = rateOf(w.asset);
            const usd = Number(w.available) * rate;
            return (
              <Card key={w.id} hover className="p-4 flex items-center gap-4">
                <AssetIcon symbol={w.asset} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-zinc-100">{w.asset}</span>
                    <span className="text-[8.5px] text-zinc-600 font-mono">{a?.network}</span>
                  </div>
                  <div className="font-mono text-[15px] text-zinc-50 mt-0.5">{fmtCrypto(Number(w.available))}</div>
                  <div className="text-[9.5px] text-zinc-500 font-mono">{fmtUsd(usd)}{Number(w.locked) > 0 && <span className="text-gold-400"> · {fmtCrypto(Number(w.locked))} locked</span>}</div>
                </div>
                {rate > 0 && <div className="text-[9px] font-mono font-semibold text-zinc-400">{fmtUsd(rate, rate < 2 ? 3 : 0)}</div>}
              </Card>
            );
          })}
        </div>
      </div>

      {/* honest integration notice */}
      <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 flex items-start gap-2.5">
        <Info size={14} className="text-sky-300 shrink-0 mt-0.5" />
        <p className="text-[10.5px] text-sky-100/70 leading-relaxed"><span className="font-bold text-sky-200">Custody model:</span> Digital Coin Lottery custodies platform balances in treasury-controlled wallets (Turnkey/Fireblocks-ready). Deposits are detected from on-chain data only. We never ask for private keys or seed phrases, and this interface never claims an unverified transaction succeeded.</p>
      </div>
    </div>
  );
}

/* ================= OFFICIAL BROADCAST ADDRESSES ================= */
function OfficialTab({ addresses, onDeposit }: { addresses: PlatformAddress[]; onDeposit: () => void }) {
  const [ack, setAck] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold-500/35 bg-gradient-to-r from-gold-500/14 to-transparent px-5 py-4 flex items-start gap-3">
        <Landmark size={22} className="text-gold-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display text-[15px] text-gold-100">Official Platform Payment Addresses</h2>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">These are <span className="text-gold-300 font-semibold">treasury broadcast addresses</span> — the only destinations recognized for qualifying deposits and prize claims. They are published by the administrator and synchronized to every member in real time. <span className="text-zinc-500">Copying an address never credits a wallet</span>; deposits are verified on-chain before any balance moves.</p>
        </div>
      </div>

      {addresses.length === 0 ? (
        <Card><EmptyState icon={<Landmark size={26} />} title="No official addresses published yet" body="The treasury administrator has not broadcast any payment addresses. Check back shortly — this list updates in real time." /></Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {addresses.map((a) => {
            const memoInfo = requiresMemo(a.asset, a.network);
            return (
              <Card key={a.id} sheen className="p-5 flex flex-col gap-3 border-gold-500/25">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={a.asset} size={38} />
                    <div>
                      <h3 className="text-[13.5px] font-extrabold text-zinc-50 leading-tight">{a.title}</h3>
                      <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{a.purpose}</p>
                    </div>
                  </div>
                  <span className="chip chip-live"><span className="pulse-dot !w-1.5 !h-1.5" />Active</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-1 rounded-md bg-black/55 border border-white/8 text-gold-200 font-bold">{a.asset}</span>
                  <span className="px-2 py-1 rounded-md bg-black/55 border border-white/8 text-zinc-300">{a.network}</span>
                  <span className="text-zinc-600 ml-auto">updated {timeAgo(a.updated_at)}</span>
                </div>

                {/* full address block */}
                <div className="rounded-xl border border-gold-500/25 bg-black/60 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[8.5px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold">Deposit Address</span>
                    <CopyButton value={a.address} label="Address" />
                  </div>
                  <p className="font-mono text-[10.5px] sm:text-[11px] text-gold-100 leading-relaxed break-all select-all">{a.address}</p>
                </div>

                {/* memo / tag */}
                {a.memo ? (
                  <div className="rounded-xl border border-amber-400/35 bg-amber-400/6 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[8.5px] uppercase tracking-[0.2em] text-amber-300/90 font-extrabold flex items-center gap-1"><Tag size={10} />Required Memo / Tag</span>
                      <CopyButton value={a.memo} label="Memo" />
                    </div>
                    <p className="font-mono text-[13px] text-amber-200 font-semibold select-all">{a.memo}</p>
                    <p className="text-[9px] text-amber-200/60 mt-1">Omitting the memo will strand your deposit. Always include it exactly as shown.</p>
                  </div>
                ) : memoInfo.required ? (
                  <div className="rounded-xl border border-amber-400/35 bg-amber-400/6 p-3 text-[10.5px] text-amber-200/85"><Tag size={11} className="inline mr-1" />This network normally requires a memo/tag. The treasury has indicated none for this address — follow the published instructions below.</div>
                ) : null}

                {/* instructions */}
                {a.instructions && (
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <div className="text-[8.5px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold mb-1">Treasury Instructions</div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">{a.instructions}</p>
                  </div>
                )}

                {/* confirmation acknowledgment */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-white/8 px-3 py-2.5 hover:border-gold-500/35 transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-[#e2a62e] w-4 h-4" checked={!!ack[a.id]} onChange={(e) => setAck((p) => ({ ...p, [a.id]: e.target.checked }))} />
                  <span className="text-[10.5px] text-zinc-400 leading-snug">I verified the asset <span className="text-zinc-100 font-bold">({a.asset})</span>, network <span className="text-zinc-100 font-bold">({a.network})</span> and the complete address character-for-character before sending. Sending to a wrong network loses funds permanently.</span>
                </label>
                <DCLButton gold size="sm" disabled={!ack[a.id]} onClick={onDeposit} className="w-full"><ArrowDownLeft size={13} />I've sent funds — record my deposit</DCLButton>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-[9px] text-zinc-600 font-mono text-center px-4">Addresses are broadcast by the treasury administrator and identical for every member. They rotate without notice — always copy from this screen, never from emails or screenshots.</p>
    </div>
  );
}

/* ================= DEPOSIT ================= */
function DepositTab({ addresses, deposits, assets, onDone }: { addresses: PlatformAddress[]; deposits: Deposit[]; assets: Asset[]; onDone: () => Promise<void> }) {
  const { userId } = useAuth();
  const { push } = useToast();
  const [asset, setAsset] = useState('BTC');
  const [addressId, setAddressId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const matching = addresses.filter((a) => a.asset === asset);
  const selected = matching.find((a) => a.id === addressId) ?? matching[0];
  useEffect(() => { const m = addresses.filter((a) => a.asset === asset); setAddressId(m[0]?.id ?? ''); }, [asset, addresses]);

  const amountNum = Number(amount);
  const amountValid = amount && Number.isFinite(amountNum) && amountNum > 0;
  const hashValid = validateTxHash(txHash);
  const canSubmit = amountValid && hashValid && !!selected && !submitting;

  const submit = async () => {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    try {
      const { data, error } = await getClient().rpc('record_deposit', {
        p_asset: asset,
        p_network: selected.network,
        p_amount: amountNum,
        p_tx_hash: txHash.trim(),
        p_platform_address_id: selected.id,
        p_idempotency_key: `dep:${userId}:${txHash.trim()}`,
      });
      if (error) throw error;
      void data;
      push('success', 'Deposit recorded — pending verification', 'The treasury will confirm your transaction on-chain. Balances update after verification, typically within hours.');
      setAmount(''); setTxHash('');
      await onDone();
    } catch (e) {
      push('error', 'Could not record deposit', friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <Card sheen className="lg:col-span-2 p-5 sm:p-6 h-fit">
        <h2 className="font-display text-[16px] text-gold-100 flex items-center gap-2"><ArrowDownLeft size={16} className="text-gold-400" />Record a deposit</h2>
        <p className="text-[10.5px] text-zinc-500 mt-1 leading-snug">Sent funds to an official platform address? Submit the transaction below. Crediting happens <span className="text-zinc-300 font-bold">only after the treasury independently verifies the transaction on-chain</span> — never from this form.</p>
        <div className="space-y-4 mt-4">
          <div>
            <label className="flabel" htmlFor="dep-asset">Asset</label>
            <select id="dep-asset" className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>
              {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="flabel" htmlFor="dep-addr">Destination (official) address</label>
            <select id="dep-addr" className="field font-mono !text-[11px]" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
              {matching.length === 0 ? <option value="">No {asset} address published — pick another asset</option> : matching.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.network} · {truncateMiddle(a.address, 12, 10)}</option>)}
            </select>
          </div>
          <div>
            <label className="flabel" htmlFor="dep-amount">Amount sent</label>
            <input id="dep-amount" className="field font-mono" type="number" min="0" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!amount && !amountValid} />
          </div>
          <div>
            <label className="flabel" htmlFor="dep-hash">Transaction hash / ID</label>
            <input id="dep-hash" className="field font-mono !text-[11px]" type="text" placeholder="0x9f3a… or bc1q…" value={txHash} onChange={(e) => setTxHash(e.target.value)} aria-invalid={!!txHash && !hashValid} />
            {txHash && !hashValid && <p className="text-[10px] text-rose-400 mt-1">Doesn't look like a valid transaction hash.</p>}
          </div>
          <DCLButton gold className="w-full" size="lg" disabled={!canSubmit} loading={submitting} onClick={submit}>
            <ShieldCheck size={16} />Submit for treasury verification
          </DCLButton>
          <p className="text-[9px] text-zinc-600 font-mono text-center leading-relaxed">Screenshots, copied addresses and unverified hashes are not proof of payment.<br />Duplicate hashes are rejected automatically.</p>
        </div>
      </Card>

      <div className="lg:col-span-3">
        <h3 className="font-display text-[13px] uppercase tracking-[0.15em] text-zinc-500 mb-2">Your deposit history</h3>
        <div className="space-y-2.5">
          {deposits.length === 0 && <Card><EmptyState icon={<ArrowDownLeft size={24} />} title="No deposits yet" body="Send to an official address, then submit the transaction hash here. It will appear instantly while pending verification." /></Card>}
          {deposits.map((d) => {
            const statusStyle: Record<Deposit['status'], string> = {
              pending: 'chip-open', confirming: 'chip-open', confirmed: 'chip-drawn', credited: 'chip-paid', rejected: 'chip-gray',
            };
            return (
              <Card key={d.id} className="p-4 flex items-center gap-3">
                <AssetIcon symbol={d.asset} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold text-zinc-100">{fmtCrypto(Number(d.amount))} {d.asset}</span>
                    <span className="text-[8.5px] font-mono text-zinc-600">{d.network}</span>
                    <span className={`chip ${statusStyle[d.status]}`}>{d.status}</span>
                  </div>
                  {d.tx_hash && <p className="font-mono text-[9px] text-zinc-600 truncate mt-1">tx {truncateMiddle(d.tx_hash, 14, 12)}</p>}
                  <p className="text-[8.5px] text-zinc-700 font-mono mt-0.5">{timeAgo(d.created_at)}{d.status === 'pending' && d.confirmations === 0 ? ` · 0/${d.required_confirmations} confirmations — awaiting treasury` : d.status === 'credited' ? ` · credited ${d.credited_at ? timeAgo(d.credited_at) : ''}` : ` · ${d.confirmations}/${d.required_confirmations} confirmations`}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================= SEND ================= */
function SendTab({ wallets, assets, rateOf, onDone }: { wallets: Wallet[] | null; assets: Asset[]; rateOf: (s: string) => number; onDone: () => Promise<void> }) {
  const { push } = useToast();
  const [mode, setMode] = useState<'member' | 'external'>('member');
  const [asset, setAsset] = useState('USDT');
  const [recipient, setRecipient] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('TRC-20');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [busy, setBusy] = useState(false);

  const wallet = wallets?.find((w) => w.asset === asset);
  const available = wallet ? Number(wallet.available) : 0;
  const assetInfo = assets.find((a) => a.symbol === asset);
  const fee = mode === 'external' ? Number(assetInfo?.withdraw_fee ?? 0) : 0;
  const amountNum = Number(amount);
  const amountValid = amount && Number.isFinite(amountNum) && amountNum > 0 && amountNum + fee <= available;
  const addrCheck = validateAddress(asset, network, address);
  const recipientValid = recipient.trim().length >= 3;
  const canReview = mode === 'member' ? (amountValid && recipientValid) : (amountValid && addrCheck.ok && network.length > 0);

  const networks = asset === 'BTC' ? ['Bitcoin'] : asset === 'ETH' ? ['ERC-20'] : asset === 'USDT' ? ['TRC-20', 'ERC-20'] : asset === 'USDC' ? ['ERC-20'] : asset === 'BNB' ? ['BEP-20'] : asset === 'SOL' ? ['Solana'] : asset === 'XRP' ? ['Ripple'] : ['Dogecoin'];
  useEffect(() => { setNetwork(networks[0]); }, [asset]); // eslint-disable-line react-hooks/exhaustive-deps

  const execute = async () => {
    setBusy(true);
    try {
      if (mode === 'member') {
        const { error } = await getClient().rpc('internal_transfer', { p_recipient: recipient.trim(), p_asset: asset, p_amount: amountNum, p_note: note.trim() });
        if (error) throw error;
        push('success', 'Transfer sent', `${fmtCrypto(amountNum)} ${asset} delivered to ${recipient.trim()}.`);
      } else {
        // external withdrawal: atomic debit + queued for treasury signing (funds held, never lost)
        const { data, error } = await getClient().rpc('request_external_withdrawal', {
          p_asset: asset, p_network: network, p_address: address.trim(), p_amount: amountNum,
        });
        if (error) throw error;
        const res = data as { ref: string; fee: number };
        push('info', 'Withdrawal queued for treasury signing', `Ref ${res.ref} — ${fmtCrypto(amountNum)} ${asset} held (fee ${res.fee} ${asset}) until the treasury signer broadcasts. Track it in Activity.`);
      }
      setAmount(''); setRecipient(''); setAddress(''); setNote(''); setStep('form');
      await onDone();
    } catch (e) {
      push('error', 'Transfer failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const usd = amountValid ? amountNum * rateOf(asset) : 0;

  return (
    <div className="max-w-xl mx-auto">
      <Card sheen className="p-5 sm:p-6">
        <h2 className="font-display text-[16px] text-gold-100 flex items-center gap-2"><ArrowUpRight size={16} className="text-gold-400" />Send {asset}</h2>
        <p className="text-[10.5px] text-zinc-500 mt-1">Member-to-member transfers settle instantly and free. External withdrawals are signed by the treasury signer after review.</p>

        {/* mode toggle */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1.5 rounded-2xl bg-black/50 border border-white/6">
          {([['member', 'To a member'], ['external', 'External address']] as const).map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setStep('form'); }} className={`py-2.5 rounded-xl text-[11.5px] font-extrabold transition-all ${mode === m ? 'bg-gold-500/18 text-gold-100 border border-gold-500/45' : 'text-zinc-500 border border-transparent'}`}>{label}</button>
          ))}
        </div>

        {step === 'form' ? (
          <div className="space-y-4 mt-4">
            <div>
              <label className="flabel" htmlFor="send-asset">Asset</label>
              <select id="send-asset" className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>
                {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol} — available {fmtCrypto(Number(wallets?.find((w) => w.asset === a.symbol)?.available ?? 0))}</option>)}
              </select>
            </div>
            {mode === 'member' ? (
              <div>
                <label className="flabel" htmlFor="send-rcpt">Recipient (member username or email)</label>
                <input id="send-rcpt" className="field" placeholder="e.g. bram_the_brave or name@example.com" value={recipient} onChange={(e) => setRecipient(e.target.value)} autoComplete="off" />
              </div>
            ) : (
              <>
                <div>
                  <label className="flabel" htmlFor="send-net">Network</label>
                  <select id="send-net" className="field" value={network} onChange={(e) => setNetwork(e.target.value)}>{networks.map((n) => <option key={n}>{n}</option>)}</select>
                </div>
                <div>
                  <label className="flabel" htmlFor="send-addr">Destination address</label>
                  <input id="send-addr" className="field font-mono !text-[11px]" placeholder="Paste full address" value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={!!address && !addrCheck.ok} autoComplete="off" spellCheck={false} />
                  {address && <p className={`text-[10px] mt-1 ${addrCheck.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{addrCheck.message}</p>}
                </div>
              </>
            )}
            <div>
              <label className="flabel" htmlFor="send-amount">Amount</label>
              <div className="relative">
                <input id="send-amount" className="field font-mono !pr-16" type="number" min="0" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-extrabold text-gold-400 hover:text-gold-200 uppercase tracking-wider px-2 py-1.5 rounded-lg border border-gold-500/30" onClick={() => setAmount(String(Math.max(0, available - fee)))}>Max</button>
              </div>
              <p className="text-[9.5px] text-zinc-600 font-mono mt-1">Available: {fmtCrypto(available)} {asset}{fee > 0 && ` · network fee ${fee} ${asset}`}{amountValid && ` · ≈ ${fmtUsd(usd)}`}</p>
            </div>
            <div>
              <label className="flabel" htmlFor="send-note">Note (optional)</label>
              <input id="send-note" className="field" placeholder="What's it for?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
            </div>
            <DCLButton gold size="lg" className="w-full" disabled={!canReview} onClick={() => setStep('review')}>Review transfer <ChevronRight size={15} /></DCLButton>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-gold-500/30 bg-gold-500/6 divide-y divide-white/6 text-[12px]">
              {[
                ['From', 'Your treasury wallet'],
                ['To', mode === 'member' ? recipient.trim() : truncateMiddle(address, 16, 14)],
                ['Network', mode === 'member' ? 'Internal ledger (instant, free)' : network],
                ['Amount', `${fmtCrypto(amountNum)} ${asset} ≈ ${fmtUsd(usd)}`],
                ['Network fee', `${fee} ${asset}`],
                ['You send', `${fmtCrypto(amountNum + fee)} ${asset}`],
              ].map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><span className="text-zinc-500">{k}</span><span className="font-mono text-zinc-100 text-right break-all">{v}</span></div>)}
            </div>
            <div className="flex gap-2">
              <DCLButton ghost className="flex-1" onClick={() => setStep('form')}>Back</DCLButton>
              <DCLButton gold className="flex-1" loading={busy} onClick={execute}><ShieldCheck size={15} />Confirm &amp; send</DCLButton>
            </div>
            <p className="text-[9px] text-zinc-600 font-mono text-center">Confirmed transfers are final and ledgered. Double-spend and negative-balance races are prevented by database row locking.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= SWAP ================= */
function SwapTab({ wallets, assets, prices, onDone }: { wallets: Wallet[] | null; assets: Asset[]; prices: Record<string, { usd: number; change24h: number }>; onDone: () => Promise<void> }) {
  const { push } = useToast();
  const [from, setFrom] = useState('BTC');
  const [to, setTo] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [busy, setBusy] = useState(false);

  const wallet = wallets?.find((w) => w.asset === from);
  const available = wallet ? Number(wallet.available) : 0;
  const fromRate = prices[from]?.usd ?? (from === 'USDT' || from === 'USDC' ? 1 : 0);
  const toRate = prices[to]?.usd ?? (to === 'USDT' || to === 'USDC' ? 1 : 0);
  const amountNum = Number(amount);
  const amountValid = amount && Number.isFinite(amountNum) && amountNum > 0 && amountNum <= available && fromRate > 0 && toRate > 0;
  const feePct = 0.006;
  const out = amountValid ? (amountNum * fromRate * (1 - feePct)) / toRate : 0;
  const minReceive = out * (1 - slippage / 100);
  const rate = fromRate / toRate;

  const execute = async () => {
    if (!amountValid) return;
    setBusy(true);
    try {
      const { data, error } = await getClient().rpc('execute_swap', { p_from_asset: from, p_to_asset: to, p_amount: amountNum, p_min_receive: minReceive });
      if (error) throw error;
      const res = data as { to_amount: number; fee_usd: number; tx_ref: string };
      push('success', 'Swap executed', `${fmtCrypto(amountNum)} ${from} → ${fmtCrypto(Number(res.to_amount))} ${to} · fee ${fmtUsd(Number(res.fee_usd))} · ref ${res.tx_ref}`);
      setAmount('');
      await onDone();
    } catch (e) {
      push('error', 'Swap failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const flip = () => { setFrom(to); setTo(from); setAmount(''); };

  return (
    <div className="max-w-xl mx-auto">
      <Card sheen className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[16px] text-gold-100 flex items-center gap-2"><ArrowLeftRight size={16} className="text-gold-400" />Swap assets</h2>
          <span className="text-[8.5px] font-mono text-zinc-600">0.60% treasury fee · oracle-priced</span>
        </div>

        {/* from */}
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/45 p-4">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-extrabold"><span>You pay</span><button className="text-gold-400 hover:text-gold-200" onClick={() => setAmount(String(available))}>Max: {fmtCrypto(available)}</button></div>
          <div className="flex items-center gap-3 mt-2">
            <select className="field !w-auto font-mono font-bold" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From asset">
              {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
            </select>
            <input className="field font-mono text-xl text-right" type="number" min="0" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount to swap" />
          </div>
          <p className="text-[9.5px] text-zinc-600 font-mono mt-1.5 text-right">≈ {fmtUsd(amountValid ? amountNum * fromRate : 0)}</p>
        </div>

        <div className="flex justify-center -my-2.5 relative z-10">
          <button onClick={flip} className="w-11 h-11 rounded-full border border-gold-500/50 bg-[#171208] text-gold-300 hover:text-gold-100 hover:border-gold-400 transition-all flex items-center justify-center shadow-[0_0_20px_-4px_rgba(226,166,46,0.5)]" aria-label="Flip assets"><ArrowLeftRight size={17} className="rotate-90" /></button>
        </div>

        {/* to */}
        <div className="rounded-2xl border border-gold-500/25 bg-gold-500/4 p-4">
          <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-extrabold">You receive (est.)</div>
          <div className="flex items-center gap-3 mt-2">
            <select className="field !w-auto font-mono font-bold" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To asset">
              {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
            </select>
            <div className="flex-1 font-mono text-xl text-right text-gold-100">{out > 0 ? fmtCrypto(out) : '0.00'}</div>
          </div>
          <p className="text-[9.5px] text-zinc-600 font-mono mt-1.5 text-right">≈ {fmtUsd(out * toRate)}</p>
        </div>

        {/* quote details */}
        <div className="rounded-2xl border border-white/8 divide-y divide-white/6 mt-4 text-[11px]">
          {[
            ['Rate', `1 ${from} = ${rate.toPrecision(6)} ${to}`],
            ['Treasury fee (0.60%)', `${fmtUsd(amountValid ? amountNum * fromRate * feePct : 0)}`],
            ['Minimum received', `${fmtCrypto(minReceive)} ${to}`],
            ['Price source', 'Treasury oracle (CoinGecko snapshot)'],
          ].map(([k, v]) => <div key={k} className="flex justify-between px-4 py-2"><span className="text-zinc-500">{k}</span><span className="font-mono text-zinc-200">{v}</span></div>)}
          <div className="flex justify-between px-4 py-2 items-center"><span className="text-zinc-500">Slippage tolerance</span>
            <div className="flex gap-1">{[0.5, 1, 2].map((s) => <button key={s} onClick={() => setSlippage(s)} className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border ${slippage === s ? 'border-gold-500/60 text-gold-200 bg-gold-500/12' : 'border-white/10 text-zinc-500'}`}>{s}%</button>)}</div>
          </div>
        </div>

        {from === to && <p className="text-[10.5px] text-rose-300 mt-2 flex items-center gap-1.5"><AlertTriangle size={12} />Choose two different assets.</p>}
        {amount && !amountValid && available < amountNum && <p className="text-[10.5px] text-rose-300 mt-2 flex items-center gap-1.5"><AlertTriangle size={12} />Insufficient available {from}.</p>}

        <DCLButton gold size="lg" className="w-full mt-4" disabled={!amountValid || from === to} loading={busy} onClick={execute}>
          {busy ? 'Swapping…' : <><ArrowLeftRight size={16} />Confirm swap</>}
        </DCLButton>
        <p className="text-[9px] text-zinc-600 font-mono text-center mt-2 leading-relaxed">Executed atomically at the oracle price locked in this quote.<br />Failed slippage protection reverts the entire swap — you never receive less than your minimum.</p>
      </Card>
    </div>
  );
}

/* ================= ACTIVITY ================= */
function ActivityTab({ txs }: { txs: Transaction[] }) {
  const [filter, setFilter] = useState<string>('all');
  const types = useMemo(() => ['all', ...Array.from(new Set(txs.map((t) => t.type)))], [txs]);
  const shown = txs.filter((t) => filter === 'all' || t.type === filter);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <ListFilter size={13} className="text-zinc-600 shrink-0" />
        {types.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${filter === t ? 'border-gold-500/50 text-gold-200 bg-gold-500/10' : 'border-white/8 text-zinc-500'}`}>{t.replace(/_/g, ' ')}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card><EmptyState icon={<ReceiptText size={24} />} title="No transactions yet" body="Claim your welcome allocation or enter a pool — every movement is written to this ledger." /></Card>
      ) : (
        <Card className="divide-y divide-white/5 overflow-hidden">
          {shown.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gold-500/4 transition-colors">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.direction === 'credit' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>
                {t.direction === 'credit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold text-zinc-100 capitalize">{t.type.replace(/_/g, ' ')}{t.counter_asset && <span className="text-zinc-500 normal-case font-medium"> → {t.counter_asset}</span>}</p>
                <p className="text-[9px] text-zinc-600 truncate max-w-[280px] sm:max-w-md">{t.note}</p>
                <p className="text-[8.5px] text-zinc-700 font-mono mt-0.5">{t.ref} · {timeAgo(t.created_at)} · {t.status} · {t.provider}</p>
              </div>
              <div className="ml-auto text-right shrink-0">
                <p className={`font-mono text-[12px] font-semibold ${t.direction === 'credit' ? 'text-emerald-300' : 'text-zinc-200'}`}>{t.direction === 'credit' ? '+' : '−'}{fmtCrypto(Number(t.amount))} {t.asset}</p>
                {t.counter_amount != null && <p className="font-mono text-[9.5px] text-zinc-500">→ {fmtCrypto(Number(t.counter_amount))} {t.counter_asset}</p>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
