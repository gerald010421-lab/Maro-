import { CheckCircle2, AlertTriangle, Info, Coins, X } from 'lucide-react';
import { useToast } from '../lib/context';

const styles = {
  success: { icon: CheckCircle2, ring: 'border-emerald-400/40', iconCls: 'text-emerald-300', bar: 'from-emerald-400/70' },
  error: { icon: AlertTriangle, ring: 'border-rose-400/45', iconCls: 'text-rose-300', bar: 'from-rose-400/70' },
  info: { icon: Info, ring: 'border-sky-400/40', iconCls: 'text-sky-300', bar: 'from-sky-400/70' },
  gold: { icon: Coins, ring: 'border-gold-400/50', iconCls: 'text-gold-300', bar: 'from-gold-400/80' },
} as const;

export default function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-[95] flex flex-col gap-2.5 w-[min(92vw,380px)]" aria-live="polite">
      {toasts.map((t) => {
        const S = styles[t.kind];
        const Icon = S.icon;
        return (
          <div key={t.id} className={`toast-in glass rounded-xl border ${S.ring} overflow-hidden shadow-2xl`}>
            <div className="flex items-start gap-3 px-4 py-3">
              <Icon size={19} className={`${S.iconCls} mt-0.5 shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-zinc-100 leading-snug">{t.title}</p>
                {t.body && <p className="text-[11px] text-zinc-400 mt-1 leading-snug break-words font-mono">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="p-1 text-zinc-500 hover:text-zinc-100 transition-colors" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
            <div className={`h-[2px] bg-gradient-to-r ${S.bar} to-transparent`} />
          </div>
        );
      })}
    </div>
  );
}
