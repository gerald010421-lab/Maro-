import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, ArrowRight, KeyRound, ShieldCheck, CheckCircle2, Loader2, ServerCrash } from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabase';
import { validateEmail, passwordStrength } from '../lib/validation';
import { Logo, CoinMark, DCLButton, Field } from '../components/ui';

type Mode = 'signin' | 'signup' | 'reset';

export default function Auth() {
  const { session, configured } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as Mode) || 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [signupDone, setSignupDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => { if (session) navigate('/app', { replace: true }); }, [session, navigate]);

  const setMode = (m: Mode) => { setParams(m === 'signin' ? {} : { mode: m }); setTouched({}); setResetSent(false); };

  const emailErr = touched.email && !validateEmail(email) ? 'Enter a valid email address.' : null;
  const pwErr = touched.password && password.length < 6 ? 'Minimum 6 characters.' : null;
  const nameErr = touched.name && name.trim().length < 2 ? 'Tell us your name.' : null;
  const strength = passwordStrength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true, name: true });
    if (!supabase) return;
    if (!validateEmail(email)) return;
    if (mode !== 'reset' && password.length < 6) return;
    if (mode === 'signup' && name.trim().length < 2) return;

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        push('gold', 'Welcome back to the vault', 'Your session is persistent across devices.');
        navigate('/app', { replace: true });
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        if (data.session) {
          push('gold', 'Account created', 'Welcome to Digital Coin Lottery.');
          navigate('/app', { replace: true });
        } else {
          setSignupDone(true);
          push('success', 'Verification email sent', `We sent a confirmation link to ${email.trim()}`);
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth?mode=signin` });
        if (error) throw error;
        setResetSent(true);
        push('success', 'Reset link sent', 'Check your inbox — the link expires shortly.');
      }
    } catch (err) {
      push('error', mode === 'signin' ? 'Sign-in failed' : mode === 'signup' ? 'Registration failed' : 'Reset failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      push('error', 'Google sign-in unavailable', friendlyError(error));
      setBusy(false);
    }
  };

  const googleEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true';

  return (
    <div className="min-h-screen relative flex items-stretch overflow-hidden">
      <div className="app-bg" aria-hidden="true" />

      {/* ===== left: vault art panel ===== */}
      <div className="hidden lg:flex relative w-[46%] xl:w-[52%] flex-col justify-between p-10 xl:p-14 border-r border-gold-500/15 overflow-hidden">
        <img src="/assets/vault-art.jpg" alt="Treasury vault" className="absolute inset-0 w-full h-full object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/88 via-black/45 to-black/78" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,4,3,0.85)_100%)]" />
        <div className="relative">
          <Link to="/" aria-label="Back to home"><Logo /></Link>
        </div>
        <div className="relative max-w-md">
          <CoinMark size={64} className="drop-shadow-[0_0_26px_rgba(226,166,46,0.6)] mb-5" />
          <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.05]">
            <span className="text-zinc-100">Step into</span><br />
            <span className="gold-text">the treasury.</span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-4 leading-relaxed">One account. One $80,000 welcome allocation, auto-converted to BTC. Treasury-funded jackpots, live rates, and a ledger that never forgets.</p>
          <div className="mt-6 space-y-2.5 text-[11px] font-semibold text-zinc-500">
            {['Persistent sessions across every device', 'Balances isolated per asset with locked buckets', 'Every payout traceable to an on-chain reference'].map((t) => (
              <div key={t} className="flex items-center gap-2"><CheckCircle2 size={13} className="text-gold-500 shrink-0" />{t}</div>
            ))}
          </div>
        </div>
        <div className="relative text-[9px] font-mono text-zinc-600 max-w-xs">Prize draws are settled on-chain by the treasury. Digital assets are volatile — never play more than you can lose.</div>
      </div>

      {/* ===== right: form ===== */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 relative">
        <div className="w-full max-w-[430px]">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-[12px] font-bold text-zinc-500 hover:text-gold-200 mb-6"><ArrowLeft size={14} /> Home</Link>

          {!configured ? (
            /* ---------- honest setup-required state ---------- */
            <div className="glass glass-sheen rounded-3xl p-8 text-center">
              <ServerCrash size={40} className="text-gold-500 mx-auto mb-4" />
              <h1 className="font-display text-2xl text-gold-100">Backend not configured</h1>
              <p className="text-[12.5px] text-zinc-400 mt-3 leading-relaxed">This deployment has no Supabase credentials yet. Set <code className="text-gold-300 font-mono text-[11px]">VITE_SUPABASE_URL</code> and <code className="text-gold-300 font-mono text-[11px]">VITE_SUPABASE_ANON_KEY</code> in your environment, run the migrations in <code className="text-gold-300 font-mono text-[11px]">supabase/migrations/</code>, and redeploy.</p>
              <div className="mt-5 text-left rounded-2xl border border-gold-500/20 bg-black/50 p-4 font-mono text-[10.5px] text-zinc-400 space-y-1.5">
                <p><span className="text-gold-400">1.</span> supabase link --project-ref &lt;ref&gt;</p>
                <p><span className="text-gold-400">2.</span> supabase db push</p>
                <p><span className="text-gold-400">3.</span> add env vars → redeploy</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="font-display text-[28px] sm:text-[32px] font-bold text-zinc-50">
                  {mode === 'signin' ? 'Sign in to the vault' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
                </h2>
                <p className="text-[12px] text-zinc-500 mt-1.5">
                  {mode === 'signin' ? 'Your $80,000 welcome allocation is waiting inside.' : mode === 'signup' ? 'One account per member. One welcome allocation per account.' : "We'll email you a secure reset link."}
                </p>
              </div>

              {/* success panels */}
              {signupDone || resetSent ? (
                <div className="glass glass-sheen rounded-3xl p-8 text-center">
                  <div className="w-16 h-16 rounded-full border border-gold-500/40 bg-gold-500/10 flex items-center justify-center mx-auto mb-4"><Mail size={28} className="text-gold-400" /></div>
                  <h3 className="font-display text-xl text-gold-100">{signupDone ? 'Verify your inbox' : 'Reset link sent'}</h3>
                  <p className="text-[12.5px] text-zinc-400 mt-2 leading-relaxed">{signupDone ? <>We sent a confirmation link to <span className="text-gold-200 font-mono">{email}</span>. Click it to activate your account, then sign in.</> : <>If an account exists for <span className="text-gold-200 font-mono">{email}</span>, a reset link is on its way. It expires shortly.</>}</p>
                  <DCLButton ghost className="mt-6" onClick={() => setMode('signin')}><ArrowLeft size={14} /> Back to sign in</DCLButton>
                </div>
              ) : (
                <form onSubmit={submit} noValidate className="space-y-4">
                  {mode === 'signup' && (
                    <Field label="Full name" error={nameErr} id="f-name">
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                        <input id="f-name" className="field !pl-10" placeholder="Christian Mark" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} aria-invalid={!!nameErr} autoComplete="name" />
                      </div>
                    </Field>
                  )}
                  <Field label="Email" error={emailErr} id="f-email">
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input id="f-email" className="field !pl-10" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} aria-invalid={!!emailErr} autoComplete="email" />
                    </div>
                  </Field>
                  {mode !== 'reset' && (
                    <Field label="Password" error={pwErr} id="f-pw">
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                        <input id="f-pw" className="field !pl-10 !pr-11" type={showPw ? 'text' : 'password'} placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))} aria-invalid={!!pwErr} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-gold-200" aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                      {mode === 'signup' && password.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex gap-1 flex-1">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength.score ? (strength.score >= 3 ? 'bg-emerald-400' : strength.score === 2 ? 'bg-gold-400' : 'bg-rose-400') : 'bg-zinc-800'}`} />)}</div>
                          <span className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider">{strength.label}</span>
                        </div>
                      )}
                    </Field>
                  )}

                  {mode === 'signin' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-600 flex items-center gap-1.5"><ShieldCheck size={12} className="text-gold-500" />Session persists on this device</span>
                      <button type="button" onClick={() => setMode('reset')} className="font-bold text-gold-300 hover:text-gold-100">Forgot password?</button>
                    </div>
                  )}

                  <DCLButton gold size="lg" className="w-full !mt-5" type="submit" loading={busy}>
                    {mode === 'signin' ? <>Sign In <ArrowRight size={15} /></> : mode === 'signup' ? <>Create Account &amp; Claim $80,000 <ArrowRight size={15} /></> : <><KeyRound size={15} /> Send Reset Link</>}
                  </DCLButton>

                  {/* Google OAuth */}
                  {mode !== 'reset' && (
                    <>
                      <div className="flex items-center gap-3 pt-1"><div className="flex-1 h-px bg-white/8" /><span className="text-[9.5px] uppercase tracking-[0.2em] text-zinc-600 font-extrabold">or</span><div className="flex-1 h-px bg-white/8" /></div>
                      {googleEnabled ? (
                        <DCLButton type="button" className="w-full" onClick={google} loading={busy}>
                          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.2 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.2 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.4 0 10-1.8 13.9-5l-6.4-5.4C29.4 35.6 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.7l6.4 5.4C36.9 39.5 44 34 44 24c0-1.2-.1-2.7-.4-3.9z"/></svg>
                          Continue with Google
                        </DCLButton>
                      ) : (
                        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-center">
                          <p className="text-[10.5px] text-zinc-500 leading-snug"><span className="text-zinc-400 font-bold">Google sign-in is not yet configured</span> on this deployment.<br />Enable it in Supabase → Authentication → Providers → Google, then set <code className="font-mono text-gold-400/80">VITE_GOOGLE_OAUTH_ENABLED=true</code>.</p>
                        </div>
                      )}
                    </>
                  )}
                </form>
              )}

              <p className="text-center text-[12px] text-zinc-500 mt-6">
                {mode === 'signin' ? <>New member? <button onClick={() => setMode('signup')} className="text-gold-300 font-bold hover:text-gold-100">Create an account</button></> : mode === 'signup' ? <>Already registered? <button onClick={() => setMode('signin')} className="text-gold-300 font-bold hover:text-gold-100">Sign in</button></> : <>Remembered it? <button onClick={() => setMode('signin')} className="text-gold-300 font-bold hover:text-gold-100">Sign in</button></>}
              </p>
              <p className="text-center text-[9px] text-zinc-700 font-mono mt-4">Protected by row-level security · encrypted sessions · zero seed phrases stored</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
