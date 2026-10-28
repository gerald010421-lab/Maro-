import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProviders, useAuth } from './lib/context';
import Toaster from './components/Toaster';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Pools from './pages/Pools';
import Tickets from './pages/Tickets';
import WalletPage from './pages/Wallet';
import Announcements from './pages/Announcements';
import Chat from './pages/Chat';
import Support from './pages/Support';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import { CoinMark } from './components/ui';
import type { ReactNode } from 'react';
import { ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050403] gap-4">
      <CoinMark size={64} className="spin-coin drop-shadow-[0_0_30px_rgba(226,166,46,0.6)]" />
      <p className="text-[11px] uppercase tracking-[0.3em] text-gold-500/80 font-extrabold animate-pulse">Entering the vault…</p>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth();
  if (configured && loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin, profile } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!profile) return <FullScreenLoader />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#050403] text-center px-6">
        <ShieldX size={44} className="text-rose-400" />
        <h1 className="font-display text-2xl text-zinc-100">Treasury access denied</h1>
        <p className="text-[13px] text-zinc-500 max-w-sm">This area is restricted to the designated treasury administrator. Your account is signed in as a standard member.</p>
        <Link to="/app" className="text-[12px] font-bold text-gold-300 hover:text-gold-100 underline underline-offset-4">Return to dashboard</Link>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProviders>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/pools" element={<Pools />} />
            <Route path="/app/tickets" element={<Tickets />} />
            <Route path="/app/wallet" element={<WalletPage />} />
            <Route path="/app/announcements" element={<Announcements />} />
            <Route path="/app/chat" element={<Chat />} />
            <Route path="/app/support" element={<Support />} />
            <Route path="/app/profile" element={<Profile />} />
          </Route>
          <Route path="/admin" element={<AdminProtected><Admin /></AdminProtected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </HashRouter>
    </AppProviders>
  );
}
