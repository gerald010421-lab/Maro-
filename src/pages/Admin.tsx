import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, LayoutDashboard, Users, Landmark, Ticket, Megaphone, ScrollText,
  Inbox, ArrowDownLeft, Coins, ChevronLeft, LogOut, Menu, X, MessagesSquare, Settings2,
} from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { Logo, Avatar } from '../components/ui';
import AdminOverview from './admin/AdminOverview';
import AdminUsers from './admin/AdminUsers';
import AdminDeposits from './admin/AdminDeposits';
import AdminPools from './admin/AdminPools';
import AdminAddresses from './admin/AdminAddresses';
import AdminAnnouncements from './admin/AdminAnnouncements';
import AdminLedger from './admin/AdminLedger';
import AdminAllocations from './admin/AdminAllocations';
import AdminSupport from './admin/AdminSupport';
import AdminAssets from './admin/AdminAssets';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Members & Balances', icon: Users },
  { id: 'deposits', label: 'Deposit Verification', icon: ArrowDownLeft },
  { id: 'pools', label: 'Pools & Draws', icon: Ticket },
  { id: 'addresses', label: 'Payment Addresses', icon: Landmark },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'allocations', label: 'Welcome Allocations', icon: Coins },
  { id: 'ledger', label: 'Audit Ledger', icon: ScrollText },
  { id: 'assets', label: 'Assets & Rates', icon: Settings2 },
  { id: 'support', label: 'Support Inbox', icon: Inbox },
] as const;

export type AdminSection = (typeof SECTIONS)[number]['id'];

export default function Admin() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [section, setSection] = useState<AdminSection>('overview');
  const [navOpen, setNavOpen] = useState(false);

  const name = profile?.full_name || profile?.email?.split('@')[0] || 'Treasury';

  return (
    <div className="min-h-screen text-zinc-100 relative">
      <div className="app-bg" aria-hidden="true">
        <div className="app-bg-orb w-[440px] h-[440px] right-[-120px] top-[-80px]" style={{ background: 'radial-gradient(circle, rgba(255,140,60,0.16), transparent 70%)' }} />
      </div>

      {/* admin top bar */}
      <header className="sticky top-0 z-40 h-16 flex items-center gap-3 px-4 sm:px-6 border-b border-amber-500/20 bg-[#0d0906]/92 backdrop-blur-2xl">
        <button className="lg:hidden p-2 text-zinc-300" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle admin nav">{navOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <Link to="/app" className="flex items-center gap-2 text-[11px] font-extrabold text-zinc-500 hover:text-gold-200 transition-colors"><ChevronLeft size={14} /><span className="hidden sm:inline">Member app</span></Link>
        <div className="h-5 w-px bg-amber-500/25 hidden sm:block" />
        <div className="flex items-center gap-2">
          <ShieldCheck size={17} className="text-amber-400" />
          <span className="font-display text-[13px] tracking-[0.18em] text-amber-200 font-bold hidden xs:inline">TREASURY CONSOLE</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="chip chip-admin"><ShieldCheck size={9} />ADMIN</span>
          <Avatar name={name} color={profile?.avatar_color} size={32} />
          <button onClick={() => signOut().then(() => navigate('/'))} className="p-2.5 rounded-xl text-zinc-500 hover:text-rose-300 hover:bg-rose-500/8" aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <div className="relative z-10 flex">
        {/* admin sidebar */}
        <aside className={`fixed lg:sticky top-16 z-30 h-[calc(100vh-4rem)] w-[240px] shrink-0 border-r border-amber-500/14 bg-[#0c0805]/95 backdrop-blur-2xl flex flex-col transition-transform duration-300 ${navOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Admin sections">
            <div className="px-3 pb-2 text-[9px] uppercase tracking-[0.22em] text-amber-600/80 font-extrabold">Operations</div>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setSection(id); setNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all border ${section === id ? 'text-amber-100 border-amber-500/40 bg-gradient-to-r from-amber-500/18 to-transparent' : 'text-zinc-500 border-transparent hover:text-zinc-100 hover:bg-white/[0.03]'}`}>
                <Icon size={16} className={section === id ? 'text-amber-400' : ''} />
                {label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-amber-500/14">
            <Logo compact />
            <p className="text-[8px] text-zinc-700 font-mono mt-1.5">Every mutation is server-authorized, ledgered &amp; attributable.</p>
          </div>
        </aside>
        {navOpen && <button className="fixed inset-0 top-16 z-20 bg-black/70 lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close" />}

        {/* section body */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 max-w-[1200px]">
          {section === 'overview' && <AdminOverview onNavigate={setSection} />}
          {section === 'users' && <AdminUsers />}
          {section === 'deposits' && <AdminDeposits />}
          {section === 'pools' && <AdminPools />}
          {section === 'addresses' && <AdminAddresses />}
          {section === 'announcements' && <AdminAnnouncements />}
          {section === 'allocations' && <AdminAllocations />}
          {section === 'ledger' && <AdminLedger />}
          {section === 'assets' && <AdminAssets />}
          {section === 'support' && <AdminSupport />}
        </main>
      </div>
    </div>
  );
}
