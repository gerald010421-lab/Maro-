import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, Mail, CalendarDays, ShieldCheck, KeyRound, Save, LogOut, Palette, Check } from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { getClient, friendlyError } from '../lib/supabase';
import { fullDate } from '../lib/format';
import { Card, DCLButton, Avatar, Field, CoinMark } from '../components/ui';

const AVATAR_COLORS = ['#e2a62e', '#f7931a', '#26a17b', '#8a9cff', '#b388ff', '#ff6b6b', '#3ddc97', '#f0b90b', '#9fb8d8'];

export default function Profile() {
  const { profile, userId, signOut, refreshProfile, isAdmin } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [color, setColor] = useState(profile?.avatar_color ?? '#e2a62e');
  const [saving, setSaving] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const uname = username.trim();
    if (uname && !/^[A-Za-z0-9_.-]{3,24}$/.test(uname)) { push('error', 'Invalid username', '3–24 chars: letters, digits, _ . - only.'); return; }
    setSaving(true);
    try {
      const { error } = await getClient().from('profiles')
        .update({ full_name: name.trim() || null, username: uname || null, avatar_color: color })
        .eq('id', userId);
      if (error) throw error;
      await refreshProfile();
      push('success', 'Profile saved', 'Your vault identity has been updated.');
    } catch (e2) {
      push('error', 'Save failed', friendlyError(e2));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!profile?.email) return;
    setPwBusy(true);
    try {
      const { error } = await getClient().auth.resetPasswordForEmail(profile.email, { redirectTo: `${window.location.origin}/auth?mode=signin` });
      if (error) throw error;
      push('success', 'Reset email sent', 'Use the link in your inbox to set a new password.');
    } catch (e2) {
      push('error', 'Could not send reset', friendlyError(e2));
    } finally {
      setPwBusy(false);
    }
  };

  const memberSince = profile?.created_at ? fullDate(profile.created_at) : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold"><UserRound size={12} />Identity</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-50 mt-1">Profile &amp; <span className="gold-text">Security</span></h1>
      </div>

      {/* identity band */}
      <Card sheen className="p-6 flex flex-col sm:flex-row items-center gap-5">
        <Avatar name={profile?.full_name || profile?.email || 'Member'} color={color} size={84} className="!text-3xl" />
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h2 className="font-display text-xl text-zinc-50 truncate">{profile?.full_name || 'Unnamed member'}</h2>
          <p className="text-[11px] text-zinc-500 font-mono truncate flex items-center gap-1.5 justify-center sm:justify-start"><Mail size={10} />{profile?.email}</p>
          <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start text-[9.5px] text-zinc-600 font-mono flex-wrap">
            <span className="flex items-center gap-1"><CalendarDays size={10} />member since {memberSince}</span>
            {isAdmin && <span className="chip chip-admin"><ShieldCheck size={9} />Treasury Administrator</span>}
          </div>
        </div>
        <CoinMark size={54} className="hidden sm:block opacity-80" />
      </Card>

      <form onSubmit={save}>
        <Card className="p-5 sm:p-6 space-y-4">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold flex items-center gap-2"><Palette size={12} className="text-gold-500" />Public identity (shown in chat)</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Display name" id="p-name">
              <input id="p-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} />
            </Field>
            <Field label="Username" hint="3–24 chars · letters, digits, _ . -" id="p-username">
              <input id="p-username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="bram_the_brave" maxLength={24} autoComplete="off" />
            </Field>
          </div>
          <div>
            <span className="flabel">Avatar hue</span>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setColor(c)} className="w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center" style={{ background: `linear-gradient(150deg, ${c}, ${c}77)`, borderColor: color === c ? '#f7cf5c' : 'transparent', transform: color === c ? 'scale(1.18)' : 'scale(1)' }} aria-label={`Avatar color ${c}`} aria-pressed={color === c}>
                  {color === c && <Check size={15} className="text-black/80" />}
                </button>
              ))}
            </div>
          </div>
          <DCLButton gold type="submit" loading={saving}><Save size={14} />Save changes</DCLButton>
        </Card>
      </form>

      <Card className="p-5 sm:p-6">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-extrabold flex items-center gap-2 mb-3"><KeyRound size={12} className="text-gold-500" />Security</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl border border-white/8 p-4">
          <div>
            <p className="text-[12px] font-bold text-zinc-200">Change password</p>
            <p className="text-[10.5px] text-zinc-500 mt-0.5">We'll email a secure one-time reset link to {profile?.email}.</p>
          </div>
          <DCLButton ghost size="sm" loading={pwBusy} onClick={changePassword}>Send reset link</DCLButton>
        </div>
        <div className="rounded-2xl border border-white/8 p-4 mt-3 text-[10px] text-zinc-600 leading-relaxed font-mono">
          Your session uses encrypted refresh tokens stored in this browser only. We never store, log, or request seed phrases or private keys. Admin powers are granted server-side to exactly one account (Christianmark474@gmail.com) — no profile field, including this one, can grant them.
        </div>
      </Card>

      <button onClick={() => signOut().then(() => navigate('/'))} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-rose-500/30 text-rose-300/90 hover:bg-rose-500/8 text-[12px] font-bold transition-colors">
        <LogOut size={15} /> Sign out of this device
      </button>
    </div>
  );
}
