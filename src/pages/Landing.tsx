import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Ticket, Wallet, ChevronRight, Lock, BadgeCheck, Zap, Users, Coins,
  ArrowRight, CheckCircle2, CircleDollarSign, Globe, FileCheck, Sparkles, Menu, X,
} from 'lucide-react';
import { Logo, CoinMark, Card, DCLButton } from '../components/ui';
import { usePrices } from '../lib/context';
import { ASSET_COLORS } from '../lib/cryptoAssets';

export default function Landing() {
  const { prices } = usePrices();
  const [btcPrice, setBtcPrice] = useState<number>(97420);
  useEffect(() => { if (prices['BTC']?.usd) setBtcPrice(prices['BTC'].usd); }, [prices]);
  const welcomeBtc = (80000 - 25) / btcPrice;
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen text-zinc-100 overflow-x-hidden">
      <div className="app-bg" aria-hidden="true">
        <div className="app-bg-orb w-[560px] h-[560px] right-[-160px] -top-32" style={{ background: 'radial-gradient(circle, rgba(226,166,46,0.28), transparent 70%)' }} />
        <div className="app-bg-orb w-[480px] h-[480px] left-[-150px] top-[38%]" style={{ background: 'radial-gradient(circle, rgba(160,95,28,0.26), transparent 70%)', animationDelay: '-8s' }} />
        <div className="app-bg-orb w-[420px] h-[420px] right-[8%] bottom-[-160px]" style={{ background: 'radial-gradient(circle, rgba(201,133,32,0.22), transparent 70%)', animationDelay: '-14s' }} />
      </div>

      {/* ============ NAV ============ */}
      <header className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-[12.5px] font-semibold text-zinc-400">
          <a href="#how" className="hover:text-gold-200 transition-colors">How it works</a>
          <a href="#pools" className="hover:text-gold-200 transition-colors">Pools</a>
          <a href="#security" className="hover:text-gold-200 transition-colors">Security</a>
          <a href="#faq" className="hover:text-gold-200 transition-colors">FAQ</a>
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <Link to="/auth" className="text-[12.5px] font-bold text-zinc-300 hover:text-white px-4 py-2 transition-colors">Sign in</Link>
          <Link to="/auth?mode=signup"><DCLButton gold size="sm">Join the Lottery <ChevronRight size={13} /></DCLButton></Link>
        </div>
        <button className="md:hidden p-2 text-zinc-300" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle menu">{navOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </header>
      {navOpen && (
        <div className="md:hidden relative z-30 mx-4 mb-3 glass rounded-2xl p-4 border border-gold-500/25 space-y-2">
          {['how', 'pools', 'security', 'faq'].map((a) => (
            <a key={a} href={`#${a}`} onClick={() => setNavOpen(false)} className="block px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-300 hover:text-gold-100 hover:bg-gold-500/8 capitalize">{a === 'how' ? 'How it works' : a}</a>
          ))}
          <Link to="/auth?mode=signup" className="block pt-1"><DCLButton gold className="w-full">Claim your $80,000 welcome allocation</DCLButton></Link>
        </div>
      )}

      {/* ============ HERO ============ */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-12 items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/35 bg-gold-500/8 pl-1.5 pr-3 py-1 mb-5">
              <span className="pulse-dot" />
              <span className="text-[10px] font-extrabold tracking-[0.18em] text-gold-300 uppercase">Grand Jackpot · Live Now</span>
            </div>
            <h1 className="font-display font-extrabold text-[40px] sm:text-6xl xl:text-[68px] leading-[1.02] tracking-tight">
              <span className="text-zinc-100">Win Crypto.</span><br />
              <span className="gold-text">Own the Gold.</span>
            </h1>
            <p className="mt-5 text-[15px] sm:text-lg text-zinc-400 leading-relaxed max-w-xl">
              The premium black-and-gold lottery for digital assets. Verified on-chain prizes, live BTC/ETH/USDT pools,
              an <span className="text-gold-300 font-bold">$80,000 welcome allocation</span> auto-converted to Bitcoin — one treasury-verified unlock away.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/auth?mode=signup"><DCLButton gold size="lg">Claim $80,000 Welcome <ArrowRight size={16} /></DCLButton></Link>
            <a href="#pools"><DCLButton ghost size="lg">Explore Pools</DCLButton></a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.7 }} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-zinc-500 font-semibold">
            {['One-time allocation per account', 'Auto-converted to BTC at treasury rate', 'Unlocks on verified funding'].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-gold-500" />{t}</span>
            ))}
          </motion.div>

          {/* live rate chips */}
          <div className="mt-7 flex flex-wrap gap-2">
            {['BTC', 'ETH', 'USDT'].map((sym) => {
              const p = prices[sym];
              return (
                <div key={sym} className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/45 backdrop-blur-md px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: ASSET_COLORS[sym] }} />
                  <span className="text-[10px] font-extrabold text-zinc-400 tracking-wider">{sym}</span>
                  <span className="font-mono text-[11px] text-gold-100">{p ? `$${p.usd.toLocaleString('en-US', { maximumFractionDigits: sym === 'USDT' ? 3 : 0 })}` : '—'}</span>
                  {p && <span className={`font-mono text-[9px] ${p.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.change24h >= 0 ? '▲' : '▼'}{Math.abs(p.change24h).toFixed(2)}%</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* hero composition — coin mascot + $80k panel */}
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.75, delay: 0.2 }} className="relative mx-auto w-full max-w-[480px]">
          <div aria-hidden="true" className="absolute -inset-8 vault-rays rounded-full opacity-80" />
          <Card sheen className="relative p-6 sm:p-7 text-center overflow-hidden">
            <img src="/assets/coin-hero.png" alt="Bram, the Digital Coin Lottery mascot — a smiling golden coin" className="float-slow w-40 sm:w-48 mx-auto drop-shadow-[0_18px_38px_rgba(226,166,46,0.4)]" />
            <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gold-500 font-extrabold">New Members Only</div>
            <div className="font-display gold-text text-5xl sm:text-6xl font-extrabold mt-1.5 tracking-tight">$80,000</div>
            <div className="text-[11px] text-zinc-400 mt-1 font-semibold">Welcome balance · auto-converted to Bitcoin</div>
            <div className="my-4 divider-gold" />
            <div className="flex items-center justify-between text-left gap-3">
              <div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-bold">You'd receive ≈</div>
                <div className="font-mono text-gold-200 text-lg font-semibold">{welcomeBtc.toFixed(4)} BTC</div>
                <div className="text-[9.5px] text-zinc-500 font-mono">@ ${btcPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} · live oracle rate</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Status</div>
                <span className="chip chip-open mt-1"><Lock size={9} /> Locked → Verify</span>
                <div className="text-[9px] text-zinc-600 mt-1.5 max-w-[120px] leading-snug">Unlocks after $500 qualifying funding is verified</div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="relative z-10 border-y border-gold-500/14 bg-black/55 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[10.5px] font-bold text-zinc-500">
          {[
            { icon: ShieldCheck, t: 'Treasury-verified payouts' },
            { icon: FileCheck, t: 'Append-only audit ledger' },
            { icon: Lock, t: 'Row-level security, server-enforced' },
            { icon: Globe, t: 'Real-time synced everywhere' },
            { icon: BadgeCheck, t: 'On-chain deposit verification' },
          ].map(({ icon: I, t }) => <span key={t} className="flex items-center gap-1.5"><I size={13} className="text-gold-500" />{t}</span>)}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-11">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-500 font-extrabold mb-2">The Ritual</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-zinc-100">Three steps to <span className="gold-text">the vault</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { n: '01', img: '/assets/coin-hero.png', title: 'Claim your allocation', body: 'Register and sign in. On your first verified session, $80,000 is allocated to your treasury account and converted to BTC at the live oracle rate — automatically.' },
            { n: '02', img: '/assets/vault-art.jpg', title: 'Fund to unlock', body: 'Send a qualifying $500+ deposit to any official platform address shown in your wallet. The treasury verifies it on-chain, then your locked BTC is released to spend.' },
            { n: '03', img: '/assets/coin-sleepy.png', title: 'Play & multiply', body: 'Enter Grand Jackpot pools with USDT or ETH, swap your BTC for any supported asset, hold, send — or just watch the prize pool grow.' },
          ].map((s) => (
            <Card key={s.n} hover sheen className="p-6 relative overflow-hidden group">
              <div className="absolute -top-3 -right-1 font-display text-[84px] font-extrabold text-gold-500/9 group-hover:text-gold-500/16 transition-colors select-none">{s.n}</div>
              <img src={s.img} alt="" className="h-32 sm:h-36 object-contain mx-auto drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]" loading="lazy" />
              <h3 className="font-display text-lg text-gold-100 mt-4 tracking-wide">{s.title}</h3>
              <p className="text-[12px] text-zinc-400 leading-relaxed mt-1.5">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ============ POOLS PREVIEW ============ */}
      <section id="pools" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold-500 font-extrabold mb-2">Flagship Draws</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-zinc-100">Tonight&apos;s <span className="gold-text">prize vaults</span></h2>
          </div>
          <Link to="/app/pools" className="text-[12px] font-bold text-gold-300 hover:text-gold-100 flex items-center gap-1.5 transition-colors">Enter the app <ChevronRight size={14} /></Link>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { name: 'Bitcoin Grand Jackpot', prize: '2.5 BTC', usd: '$243,500', price: '25 USDT', sold: 126, cap: 400, tone: '#f7931a', tag: 'BTC PRIZE' },
            { name: 'Ethereum High Roller', prize: '12.5 ETH', usd: '$46,000', price: '0.05 ETH', sold: 88, cap: 250, tone: '#8a9cff', tag: 'ETH PRIZE' },
          ].map((p) => (
            <Card key={p.name} hover sheen className="p-6 flex flex-col sm:flex-row gap-6 items-center">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle at 36% 32%, ${p.tone}55, ${p.tone}18 60%, transparent 75%)` }}>
                  <CoinMark size={76} />
                </div>
                <span className="absolute -bottom-1 -right-2 chip chip-open !text-[8.5px]">{p.tag}</span>
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h3 className="font-display text-[19px] text-zinc-100">{p.name}</h3>
                <div className="font-mono gold-text text-2xl font-bold mt-1">{p.prize} <span className="text-xs text-zinc-500">≈ {p.usd}</span></div>
                <div className="flex items-center gap-3 mt-3 justify-center sm:justify-start text-[11px] text-zinc-400 font-semibold">
                  <span className="flex items-center gap-1"><Ticket size={12} className="text-gold-400" />{p.price}/ticket</span>
                  <span className="flex items-center gap-1"><Users size={12} className="text-gold-400" />{p.sold}/{p.cap} sold</span>
                </div>
                <div className="h-1.5 mt-2 rounded-full bg-black/60 overflow-hidden max-w-[240px] mx-auto sm:mx-0"><div className="h-full bg-gradient-to-r from-gold-700 to-gold-300" style={{ width: `${(p.sold / p.cap) * 100}%` }} /></div>
              </div>
              <Link to="/auth?mode=signup" className="shrink-0"><DCLButton gold size="sm">Enter <ChevronRight size={13} /></DCLButton></Link>
            </Card>
          ))}
        </div>
      </section>

      {/* ============ SECURITY ============ */}
      <section id="security" className="relative z-10 border-t border-gold-500/12 bg-gradient-to-b from-black/40 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="relative">
            <img src="/assets/vault-art.jpg" alt="The Digital Coin Lottery treasury vault piled with gold coins" className="rounded-3xl border border-gold-500/25 shadow-[0_30px_80px_-20px_rgba(226,166,46,0.25)] w-full object-cover max-h-[560px]" loading="lazy" />
            <div className="absolute bottom-4 left-4 right-4 glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <ShieldCheck size={22} className="text-gold-400 shrink-0" />
              <p className="text-[10.5px] text-zinc-300 leading-snug"><span className="text-gold-200 font-bold">Treasury-custodied.</span> Prize pools are funded before launch; winners are paid on-chain after draw settlement.</p>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold-500 font-extrabold mb-2">Iron-Bound Security</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-zinc-100 leading-tight">Built like a <span className="gold-text">central-bank vault</span>, not a casino</h2>
            <div className="mt-6 space-y-4">
              {[
                { icon: Lock, t: 'Server-enforced authorization', d: 'Every privileged action runs in SECURITY DEFINER functions with row locking and idempotency. The browser can request — never dictate.' },
                { icon: FileCheck, t: 'Append-only financial ledger', d: 'Each adjustment, ticket and payout writes an immutable audit row with actor, reason and reference. Balances cannot go negative.' },
                { icon: BadgeCheck, t: 'On-chain deposit verification', d: 'Your funding is credited only after treasury confirms transactions on the asset’s network. Screenshots prove nothing; confirmations do.' },
                { icon: CircleDollarSign, t: 'Atomic purchases, zero overselling', d: 'Pool capacity is checked under a row lock inside the same transaction that debits your wallet. Sold-out means sold-out.' },
              ].map(({ icon: I, t, d }) => (
                <div key={t} className="flex gap-3.5">
                  <div className="w-10 h-10 shrink-0 rounded-xl border border-gold-500/35 bg-gold-500/8 flex items-center justify-center"><I size={18} className="text-gold-400" /></div>
                  <div>
                    <h3 className="text-[13px] font-extrabold text-zinc-100">{t}</h3>
                    <p className="text-[11.5px] text-zinc-500 leading-relaxed mt-0.5">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center mb-9">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-500 font-extrabold mb-2">Fine Print, Loud & Clear</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-zinc-100">Honest <span className="gold-text">answers</span></h2>
        </div>
        <div className="space-y-3">
          {[
            ['Is the $80,000 real?', 'Yes — it is a one-time welcome allocation funded by the platform treasury, issued once per eligible account and recorded in the immutable transaction ledger. It is auto-converted to BTC at the live oracle rate and remains locked until your first qualifying funding deposit ($500+) is verified on-chain. Until verification, it is display-only and cannot be spent, swapped or withdrawn — we will never tell you otherwise.'],
            ['How do I unlock my welcome BTC?', 'Send at least $500 in supported assets to any official platform address in Wallet → Official Payment Addresses, then submit the transaction hash through your wallet. The treasury independently verifies the deposit on-chain. The moment confirmations reach threshold, your full allocation unlocks — automatically.'],
            ['How are winners drawn?', 'Pools close at capacity or deadline. The draw consumes an auditable SHA-256 seed derived from pool ID, close timestamp, the first ticket ID and a server-side random salt. The winning index and seed hash are published on the pool record. Prizes are paid on-chain by the treasury; payout references are public.'],
            ['Can I send my locked BTC to someone else?', 'No. Locked allocation funds live in a restricted balance bucket. Transfers, swaps and ticket purchases only spend your available balance. If integrations are incomplete, the app tells you plainly instead of faking success.'],
            ['Is my wallet custodial?', 'Yes — the treasury custodies platform balances with defense-in-depth controls. We never ask for seed phrases or private keys. Deposits are detected from on-chain data, never from user claims.'],
          ].map(([q, a], i) => (
            <details key={i} className="glass rounded-2xl border border-gold-500/18 group open:border-gold-500/35 transition-colors">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 sm:px-6 py-4 text-[13.5px] font-bold text-zinc-100 marker:hidden">
                {q}
                <ChevronRight size={16} className="text-gold-400 transition-transform duration-300 group-open:rotate-90 shrink-0" />
              </summary>
              <div className="px-5 sm:px-6 pb-5 text-[12px] text-zinc-400 leading-relaxed border-t border-white/5 pt-3">{a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative glass glass-sheen rounded-3xl overflow-hidden text-center px-6 py-14 sm:py-16 border border-gold-500/35">
          <img src="/assets/coin-locked.png" alt="Bram peeking from the treasury vault" className="w-28 sm:w-36 mx-auto drop-shadow-[0_14px_34px_rgba(226,166,46,0.35)]" />
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-zinc-50 mt-4">The vault is <span className="gold-text">open</span>.</h2>
          <p className="text-zinc-400 text-[13px] sm:text-[15px] mt-3 max-w-md mx-auto">Create your account, verify your email, and watch $80,000 convert to Bitcoin in front of you.</p>
          <Link to="/auth?mode=signup" className="inline-block mt-6"><DCLButton gold size="lg">Create My Account <ArrowRight size={16} /></DCLButton></Link>
          <p className="text-[9.5px] text-zinc-600 font-mono mt-5 max-w-lg mx-auto leading-relaxed">Digital Coin Lottery is a prize-draw platform. Digital assets are volatile; only enter what you can afford to lose. Allocation eligibility, funding verification and payout rules are published in the app.</p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative z-10 border-t border-gold-500/14 bg-black/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo compact />
          <p className="text-[10px] text-zinc-600 font-mono text-center">© {new Date().getFullYear()} Digital Coin Lottery Treasury · All draws auditable · All balances ledgered</p>
          <div className="flex items-center gap-4 text-[10.5px] font-bold text-zinc-500">
            <Link to="/auth" className="hover:text-gold-200">Sign in</Link>
            <Link to="/app/announcements" className="hover:text-gold-200">Announcements</Link>
            <span className="flex items-center gap-1 text-gold-600"><Sparkles size={11} />Black &amp; Gold</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
