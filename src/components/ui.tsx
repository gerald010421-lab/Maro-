import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, useState } from 'react';
import { Copy, Check, X, AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { useToast } from '../lib/context';

/* ---------- Logo ---------- */
export function CoinMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Digital Coin Lottery emblem">
      <defs>
        <radialGradient id="cm-face" cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#ffe98a" /><stop offset="38%" stopColor="#f3c64f" />
          <stop offset="72%" stopColor="#d19a26" /><stop offset="100%" stopColor="#8a5f10" />
        </radialGradient>
        <linearGradient id="cm-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff3b0" /><stop offset="45%" stopColor="#e5b94e" /><stop offset="100%" stopColor="#6e4c08" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#cm-rim)" strokeWidth="7" />
      <circle cx="50" cy="50" r="31" fill="url(#cm-face)" stroke="#7a5410" strokeWidth="1.6" />
      <path d="M50 33.5 L55.6 46 L69.3 46.2 L58.6 54.4 L62.5 67.6 L50 59.8 L37.5 67.6 L41.4 54.4 L30.7 46.2 L44.4 46 Z" fill="#5d3f06" />
      <path d="M50 37.2 L54.5 47.3 L65.4 47.4 L57 54.3 L60.4 64.9 L50 58.7 L39.6 64.9 L43 54.3 L34.6 47.4 L45.5 47.3 Z" fill="#ffe88a" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <CoinMark size={compact ? 34 : 40} className="drop-shadow-[0_0_14px_rgba(226,166,46,0.45)]" />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[15px] tracking-[0.14em] gold-text font-bold">DIGITAL COIN</div>
          <div className="font-sans text-[10.5px] tracking-[0.32em] text-gold-200/80 font-extrabold">LOTTERY</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Buttons ---------- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  gold?: boolean;
  ghost?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
export function DCLButton({ gold, ghost, loading, size = 'md', className = '', children, disabled, ...rest }: BtnProps) {
  const pad = size === 'sm' ? 'px-3.5 py-1.5 text-[12px]' : size === 'lg' ? 'px-6 py-3 text-[15px]' : 'px-4.5 py-2.5 text-[13px]';
  const base = `inline-flex items-center justify-center gap-2 rounded-xl font-sans transition-all duration-200 whitespace-nowrap ${pad}`;
  const style = gold ? 'btn-gold' : ghost ? 'btn-ghost-gold' : 'text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.03]';
  return (
    <button {...rest} disabled={disabled || loading} className={`${base} ${style} ${className}`}>
      {gold && <span className="shine" />}
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ children, className = '', hover = false, sheen = false }: { children: ReactNode; className?: string; hover?: boolean; sheen?: boolean }) {
  return (
    <div className={`glass rounded-2xl ${sheen ? 'glass-sheen' : ''} ${hover ? 'glass-hover' : ''} ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, color, size = 38, className = '' }: { name: string; color?: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'M';
  return (
    <div
      className={`rounded-full flex items-center justify-center font-extrabold text-black/85 shrink-0 ring-1 ring-gold-200/40 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(150deg, ${color ?? '#e2a62e'}, ${color ?? '#e2a62e'}88 70%, #3a2703)` }}
    >
      {initials}
    </div>
  );
}

/* ---------- Field wrapper ---------- */
export function Field({ label, error, hint, children, id }: { label?: string; error?: string | null; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div>
      {label && <label className="flabel" htmlFor={id}>{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1" id={id ? `${id}-err` : undefined}><AlertCircle size={11} />{error}</p>
      ) : hint ? <p className="mt-1.5 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/* ---------- Skeletons ---------- */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} aria-hidden="true" />;
}
export function CardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-40 mb-3" />
      <Skeleton className="h-8 w-28 mb-2" />
      <Skeleton className="h-3 w-52" />
    </Card>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 mb-4">
        {icon ?? <Inbox size={26} />}
      </div>
      <h3 className="font-display text-gold-100 text-base tracking-wide">{title}</h3>
      {body && <p className="text-[13px] text-zinc-400 mt-1.5 max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Copy button with real verification ---------- */
export function CopyButton({ value, label, className = '' }: { value: string; label?: string; className?: string }) {
  const { push } = useToast();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const onCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy rejected');
      }
      setState('copied');
      push('success', label ? `${label} copied` : 'Copied to clipboard', value.length > 60 ? `${value.slice(0, 30)}…${value.slice(-12)}` : value);
      window.setTimeout(() => setState('idle'), 1600);
    } catch {
      setState('failed');
      push('error', 'Copy failed', 'Clipboard access was blocked — select and copy manually.');
      window.setTimeout(() => setState('idle'), 2000);
    }
  };
  return (
    <button onClick={onCopy} className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold rounded-lg px-2.5 py-1.5 border transition-all ${state === 'copied' ? 'border-emerald-400/50 text-emerald-300 bg-emerald-400/10' : state === 'failed' ? 'border-rose-400/50 text-rose-300' : 'border-gold-500/35 text-gold-300 hover:bg-gold-500/15 hover:border-gold-400/60'} ${className}`} aria-label={label ? `Copy ${label}` : 'Copy to clipboard'}>
      {state === 'copied' ? <Check size={12} /> : <Copy size={12} />}
      {state === 'copied' ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/72 backdrop-blur-[6px]" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} mx-auto glass glass-sheen rounded-t-3xl sm:rounded-2xl max-h-[94vh] overflow-y-auto shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 bg-gradient-to-b from-[#14100d] via-[#14100d]/95 to-transparent">
          <h3 className="font-display text-gold-100 text-[15px] tracking-[0.08em] uppercase">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="px-5 sm:px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Stat chip ---------- */
export function Stat({ label, value, sub, tone = 'gold' }: { label: string; value: ReactNode; sub?: string; tone?: 'gold' | 'green' | 'red' | 'zinc' }) {
  const toneCls = tone === 'green' ? 'text-emerald-300' : tone === 'red' ? 'text-rose-300' : tone === 'zinc' ? 'text-zinc-300' : 'text-gold-200';
  return (
    <div className="px-4 py-2.5 rounded-xl border border-white/6 bg-black/30">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-zinc-500 font-extrabold">{label}</div>
      <div className={`font-mono text-[15px] font-semibold mt-0.5 ${toneCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ ratio, className = '' }: { ratio: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className={`h-[7px] w-full rounded-full bg-black/60 overflow-hidden border border-white/5 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-gold-800 via-gold-500 to-gold-200 shadow-[0_0_12px_rgba(226,166,46,0.6)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}
