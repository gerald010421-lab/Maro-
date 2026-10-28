import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Ticket, Wallet as WalletIcon, Megaphone, MessagesSquare, UserRound,
  ShieldCheck, Bell, LogOut, Menu, X, ChevronDown, CircleUserRound, LifeBuoy, Ticket as TicketIcon,
} from 'lucide-react';
import { useAuth, usePrices, useToast } from '../lib/context';
import { getClient } from '../lib/supabase';
import type { Notification } from '../lib/types';
import { timeAgo, truncateMiddle } from '../lib/format';
import { CoinMark, Logo, Avatar } from './ui';

const NAV = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/pools', icon: TicketIcon, label: 'Lottery Pools' },
  { to: '/app/tickets', icon: Ticket, label: 'My Tickets' },
  { to: '/app/wallet', icon: WalletIcon, label: 'Wallet' },
  { to: '/app/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/app/chat', icon: MessagesSquare, label: 'Live Chat' },
  { to: '/app/profile', icon: UserRound, label: 'Profile' },
];

export default function Layout() {
  const { profile, isAdmin, signOut, userId } = useAuth();
  const { prices, live } = usePrices();
  const { push } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const unread = notifications.filter((n) => !n.is_read).length;

  /* load + live subscribe to notifications */
  useEffect(() => {
    if (!userId) return;
    const c = getClient();
    let mounted = true;
    c.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (mounted && data) setNotifications(data as Notification[]); });
    const ch = c.channel(`notif:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev].slice(0, 30));
        push('gold', n.title, n.body);
      })
      .subscribe();
    return () => { mounted = false; c.removeChannel(ch); };
  }, [userId, push]);

  useEffect(() => { setMenuOpen(false); setNotifOpen(false); setUserMenu(false); }, [location.pathname]);

  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await getClient().from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  };

  const tickerItems = useMemo(() => {
    const btc = prices['BTC']?.usd; const eth = prices['ETH']?.usd; const usdt = prices['USDT']?.usd;
    const parts = [
      btc ? `BTC $${btc.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null,
      eth ? `ETH $${eth.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null,
      usdt ? `USDT $${usdt.toFixed(3)}` : null,
      'Weekly Grand Jackpot — live now',
      '$80,000 welcome allocation · auto-converted to BTC',
      'Prize payouts verified on-chain by treasury',
    ].filter(Boolean) as string[];
    return [...parts, ...parts];
  }, [prices]);

  const displayName = profile?.full_name || profile?.username || profile?.email?.split('@')[0] || 'Member';

  return (
    <div className="min-h-screen text-zinc-100">
      {/* ambient background */}
      <div className="app-bg" aria-hidden="true">
        <div className="app-bg-orb w-[480px] h-[480px] left-[-140px] top-[12%]" style={{ background: 'radial-gradient(circle, rgba(226,166,46,0.24), transparent 70%)' }} />
        <div className="app-bg-orb w-[420px] h-[420px] right-[-120px] top-[42%]" style={{ background: 'radial-gradient(circle, rgba(160,95,28,0.3), transparent 70%)', animationDelay: '-9s' }} />
      </div>

      {/* price ticker */}
      <div className="relative z-20 h-8 flex items-center border-b border-gold-500/15 bg-black/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 pl-3 sm:pl-5 pr-3 shrink-0 border-r border-gold-500/15 h-full">
          <span className="live-dot" />
          <span className="text-[9px] font-extrabold tracking-[0.2em] text-gold-300 uppercase">Live Rates</span>
          {live && <span className="text-[8px] text-emerald-400 font-mono hidden sm:inline">ORACLE</span>}
        </div>
        <div className="ticker-mask overflow-hidden flex-1">
          <div className="ticker-track flex items-center gap-8 text-[10px] font-mono text-gold-100/70 whitespace-nowrap pl-4">
            {tickerItems.map((item, i) => <span key={i}>◆ {item}</span>)}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex">
        {/* ============ SIDEBAR ============ */}
        <aside className={`fixed lg:sticky top-8 z-40 h-[calc(100vh-2rem)] w-[268px] shrink-0 border-r border-gold-500/14 bg-[#0a0807]/92 backdrop-blur-2xl flex flex-col transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <div className="h-16 flex items-center justify-between px-5 border-b border-gold-500/12">
            <Link to="/app" aria-label="Digital Coin Lottery — dashboard"><Logo /></Link>
            <button className="lg:hidden p-2 text-zinc-400" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
            <div className="px-3 pb-2 text-[9px] uppercase tracking-[0.22em] text-zinc-600 font-extrabold">Menu</div>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 border ${isActive ? 'text-gold-200 border-gold-500/35 bg-gradient-to-r from-gold-500/16 via-gold-500/7 to-transparent shadow-[inset_0_1px_0_rgba(255,232,150,0.15)]' : 'text-zinc-400 border-transparent hover:text-gold-100 hover:bg-white/[0.035]'}`}>
                {({ isActive }) => (
                  <>
                    <item.icon size={17} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? 'text-gold-400' : 'text-zinc-500 group-hover:text-gold-300'} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shadow-[0_0_8px_2px_rgba(240,183,63,0.7)]" />}
                  </>
                )}
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <div className="px-3 pt-5 pb-2 text-[9px] uppercase tracking-[0.22em] text-amber-600/90 font-extrabold flex items-center gap-1.5"><ShieldCheck size={11} />Treasury</div>
                <NavLink to="/admin"
                  className={({ isActive }) => `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all border ${isActive ? 'text-amber-200 border-amber-500/40 bg-gradient-to-r from-amber-500/18 to-transparent' : 'text-amber-200/60 border-transparent hover:text-amber-100 hover:bg-amber-500/8'}`}>
                  <ShieldCheck size={17} />
                  <span className="flex-1">Admin Dashboard</span>
                  <span className="chip chip-admin !text-[8px] !px-1.5">ADMIN</span>
                </NavLink>
              </>
            )}
          </nav>

          {/* support + sign out */}
          <div className="p-3 border-t border-gold-500/12 space-y-2">
            <Link to="/app/support" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-zinc-500 hover:text-gold-200 hover:bg-white/[0.03] transition-colors">
              <LifeBuoy size={15} /> Contact Treasury Support
              <kbd className="ml-auto text-[9px] text-zinc-600 font-mono border border-white/10 rounded px-1.5 py-0.5">1:1</kbd>
            </Link>
            <button onClick={() => signOut().then(() => navigate('/'))} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-zinc-500 hover:text-rose-300 hover:bg-rose-500/6 transition-colors">
              <LogOut size={15} /> Sign out
            </button>
            <div className="px-3 text-[9px] text-zinc-700 font-mono leading-relaxed">DIGITAL COIN LOTTERY v1.0<br />Licensed treasury operations</div>
          </div>
        </aside>

        {/* mobile overlay */}
        {menuOpen && <button className="fixed inset-0 top-8 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

        {/* ============ MAIN COLUMN ============ */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* topbar */}
          <header className="sticky top-8 z-30 h-16 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 border-b border-gold-500/12 bg-[#0a0807]/88 backdrop-blur-2xl">
            <button className="lg:hidden p-2.5 -ml-1 text-zinc-300 hover:text-gold-200" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>

            {/* contextual balance pill */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/6 pl-2 pr-3 py-1.5">
              <CoinMark size={17} />
              <WalletPill />
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {/* notifications */}
              <div className="relative">
                <button onClick={() => setNotifOpen((v) => !v)} className="relative p-2.5 rounded-xl text-zinc-400 hover:text-gold-200 hover:bg-white/5 transition-colors" aria-label={`Notifications, ${unread} unread`} aria-expanded={notifOpen}>
                  <Bell size={19} />
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-gradient-to-b from-gold-300 to-gold-600 text-[9px] font-extrabold text-black flex items-center justify-center border border-black/60">{unread > 9 ? '9+' : unread}</span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-[min(94vw,380px)] glass glass-sheen rounded-2xl border border-gold-500/25 shadow-2xl overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold-300">Notifications</span>
                      <button onClick={markAllRead} className="text-[10.5px] font-bold text-zinc-400 hover:text-gold-200 transition-colors">Mark all read</button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-center text-[12px] text-zinc-500 py-8">No notifications yet.<br /><span className="text-[10.5px]">Prize wins, deposits and treasury updates will appear here.</span></p>
                      ) : notifications.slice(0, 15).map((n) => (
                        <div key={n.id} className={`px-4 py-3 border-b border-white/4 last:border-0 ${n.is_read ? 'opacity-55' : ''}`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.is_read ? 'bg-zinc-700' : 'bg-gold-400 shadow-[0_0_6px_1px_rgba(240,183,63,0.8)]'}`} />
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-zinc-100 leading-snug">{n.title}</p>
                              {n.body && <p className="text-[10.5px] text-zinc-500 mt-0.5 leading-snug">{n.body}</p>}
                              <p className="text-[9px] text-zinc-600 font-mono mt-1">{timeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* user menu */}
              <div className="relative">
                <button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors" aria-expanded={userMenu} aria-label="Account menu">
                  <Avatar name={displayName} color={profile?.avatar_color} size={34} />
                  <div className="hidden sm:block text-left max-w-[130px]">
                    <p className="text-[11.5px] font-bold leading-tight truncate">{displayName}</p>
                    <p className="text-[8.5px] text-zinc-500 font-mono truncate">{profile?.email ? truncateMiddle(profile.email, 14, 10) : ''}</p>
                  </div>
                  <ChevronDown size={14} className="text-zinc-500" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 mt-2 w-56 glass rounded-2xl border border-gold-500/25 shadow-2xl overflow-hidden z-50 py-1.5">
                    <Link to="/app/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-zinc-300 hover:text-gold-100 hover:bg-gold-500/8"><CircleUserRound size={15} />Profile &amp; security</Link>
                    <Link to="/app/support" className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-zinc-300 hover:text-gold-100 hover:bg-gold-500/8"><LifeBuoy size={15} />Treasury support</Link>
                    {isAdmin && <Link to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-amber-300 hover:bg-amber-500/10"><ShieldCheck size={15} />Admin dashboard</Link>}
                    <button onClick={() => signOut().then(() => navigate('/'))} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-zinc-400 hover:text-rose-300 hover:bg-rose-500/6"><LogOut size={15} />Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-3 sm:px-5 lg:px-7 py-5 sm:py-6 max-w-[1500px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function WalletPill() {
  const { userId } = useAuth();
  const { prices } = usePrices();
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    const c = getClient();
    let mounted = true;
    const load = () => c.from('wallets').select('asset, available, locked').then(({ data }) => {
      if (!mounted || !data) return;
      const sum = data.reduce((acc, w) => {
        const rate = prices[w.asset as string]?.usd ?? 0;
        return acc + (Number(w.available) + Number(w.locked)) * rate;
      }, 0);
      setTotal(sum);
    });
    load();
    const ch = c.channel(`walletpill:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { mounted = false; c.removeChannel(ch); };
  }, [userId, prices]);
  return (
    <span className="font-mono text-[11.5px] text-gold-100 font-semibold">
      {total == null ? '—' : `$${total.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}
      <span className="text-gold-500/70 text-[9px] ml-1.5 font-sans font-bold tracking-wider">TOTAL</span>
    </span>
  );
}
