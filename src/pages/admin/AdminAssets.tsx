import { useCallback, useEffect, useState } from 'react';
import { Settings2, RefreshCw, Power, PowerOff, Save } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast } from '../../lib/context';
import { usePrices } from '../../lib/context';
import type { Asset, PricePoint } from '../../lib/types';
import { fmtUsd } from '../../lib/format';
import { Card, DCLButton, Skeleton } from '../../components/ui';
import { AssetIcon } from '../../lib/cryptoAssets';

export default function AdminAssets() {
  const { push } = useToast();
  const { prices, live, refresh, lastUpdated } = usePrices();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getClient().from('assets').select('*').order('sort_order');
    if (error) push('error', 'Load failed', friendlyError(error));
    setAssets((data as Asset[]) ?? []);
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const toggleAsset = async (a: Asset) => {
    const { error } = await getClient().from('assets').update({ is_enabled: !a.is_enabled }).eq('symbol', a.symbol);
    if (error) { push('error', 'Update failed', friendlyError(error)); return; }
    push('info', `${a.symbol} ${a.is_enabled ? 'disabled' : 'enabled'}`, a.is_enabled ? 'Hidden from member wallets and pools.' : 'Visible to all members again.');
    await load();
  };

  const saveRate = async (symbol: string) => {
    const val = Number(priceDrafts[symbol]);
    if (!Number.isFinite(val) || val <= 0) { push('error', 'Invalid rate', 'Enter a positive USD price.'); return; }
    setBusy(true);
    const { error } = await getClient().from('price_cache').upsert({ symbol, usd: val, change_24h: 0, updated_at: new Date().toISOString() }, { onConflict: 'symbol' });
    setBusy(false);
    if (error) { push('error', 'Save failed', friendlyError(error)); return; }
    push('success', 'Rate updated', `${symbol} treasury oracle set to $${val.toLocaleString()}. New welcome claims will use this price.`);
    setPriceDrafts((p) => ({ ...p, [symbol]: '' }));
    await refresh();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><Settings2 size={20} className="text-amber-400" />Assets &amp; <span className="gold-text">Oracle Rates</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1 max-w-lg">The treasury rate snapshot is the authoritative price for welcome conversions executed inside the database. The browser also streams live CoinGecko rates for display.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-zinc-600">{live ? 'oracle: live' : 'oracle: cached'}{lastUpdated && ` · ${lastUpdated.toLocaleTimeString()}`}</span>
          <DCLButton ghost size="sm" onClick={() => refresh()}><RefreshCw size={12} />Refresh</DCLButton>
        </div>
      </div>

      {assets === null && [1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}

      <Card className="divide-y divide-white/6 overflow-hidden">
        {(assets ?? []).map((a) => {
          const live_price = prices[a.symbol]?.usd;
          return (
            <div key={a.symbol} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
              <AssetIcon symbol={a.symbol} size={36} />
              <div className="min-w-0 w-28">
                <p className="text-[12px] font-extrabold text-zinc-100">{a.symbol}</p>
                <p className="text-[8.5px] text-zinc-600 font-mono">{a.network}</p>
              </div>
              <div className="font-mono text-[11px] text-zinc-300 w-24">{fmtUsd(live_price ?? 0, (live_price ?? 0) < 2 ? 3 : 0)}</div>
              <input className="field font-mono !text-[11px] !py-1.5 !w-28" placeholder="set rate…" value={priceDrafts[a.symbol] ?? ''} onChange={(e) => setPriceDrafts((p) => ({ ...p, [a.symbol]: e.target.value }))} aria-label={`Override ${a.symbol} rate`} />
              <button onClick={() => saveRate(a.symbol)} disabled={busy || !priceDrafts[a.symbol]} className="p-2 rounded-lg border border-gold-500/30 text-gold-400 hover:bg-gold-500/10 disabled:opacity-30" aria-label="Save rate"><Save size={14} /></button>
              <button onClick={() => toggleAsset(a)} className={`ml-auto p-2 rounded-lg border transition-colors ${a.is_enabled ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'}`} aria-label={a.is_enabled ? 'Disable asset' : 'Enable asset'} title={a.is_enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
                {a.is_enabled ? <Power size={15} /> : <PowerOff size={15} />}
              </button>
            </div>
          );
        })}
      </Card>
      <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">Disabling an asset hides it from new selections; existing balances remain intact and withdrawable. Overriding a rate changes future welcome conversions only — issued allocations keep their recorded rate forever.</p>
    </div>
  );
}
