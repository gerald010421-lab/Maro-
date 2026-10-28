import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LifeBuoy, SendHorizonal, ShieldCheck } from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { getClient, friendlyError } from '../lib/supabase';
import type { SupportMessage } from '../lib/types';
import { timeAgo } from '../lib/format';
import { DCLButton } from '../components/ui';

/** Private 1:1 thread with the treasury admin. Users only ever see their own thread — enforced by RLS. */
export default function Support() {
  const { userId, profile } = useAuth();
  const { push } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const c = getClient();
    c.from('support_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(200)
      .then(({ data }) => setMessages((data as SupportMessage[]) ?? []));
    const ch = c.channel(`support:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${userId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as SupportMessage]);
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();
    // mark admin replies read via thread-scoped RPC (members only ever touch their own thread)
    c.rpc('support_mark_read').then(() => undefined);
    return () => { c.removeChannel(ch); };
  }, [userId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody('');
    try {
      const { error } = await getClient().rpc('send_support_message', { p_body: text });
      if (error) { setBody(text); throw error; }
    } catch (err) {
      push('error', 'Message not sent', friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8.5rem)] min-h-[480px]">
      <div className="flex items-center gap-3 pb-3">
        <div className="w-11 h-11 rounded-2xl border border-gold-500/40 bg-gold-500/10 flex items-center justify-center"><LifeBuoy size={20} className="text-gold-400" /></div>
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold">Private Channel</div>
          <h1 className="font-display text-xl font-bold text-zinc-50">Treasury <span className="gold-text">Support</span></h1>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono text-zinc-600"><ShieldCheck size={11} className="text-gold-500" />visible only to you &amp; treasury</span>
      </div>

      <div className="flex-1 overflow-y-auto glass rounded-2xl border border-gold-500/15 px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-14">
            <LifeBuoy size={30} className="text-zinc-800 mx-auto mb-3" />
            <p className="text-[12px] text-zinc-500 max-w-xs mx-auto leading-relaxed">Nothing yet. Ask about your welcome allocation, a pending deposit, a pool draw — the treasury admin answers here personally.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === 'user' && m.sender_id === userId;
          return (
            <div key={m.id} className={`bubble-in flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[12.5px] leading-snug ${mine ? 'bg-gold-500/22 border border-gold-500/40 text-gold-50 rounded-br-md' : 'bg-[#1a1512] border border-amber-500/25 text-zinc-100 rounded-bl-md'}`}>
                {!mine && <p className="text-[8.5px] font-extrabold uppercase tracking-[0.18em] text-amber-400 mb-1 flex items-center gap-1"><ShieldCheck size={9} />Treasury Admin</p>}
                {m.body}
                <p className="text-[8px] text-zinc-600 font-mono mt-1">{timeAgo(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 pt-3">
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Write to the treasury…" className="field !py-3.5 !rounded-2xl" aria-label="Support message" />
        <DCLButton gold type="submit" loading={sending} className="!px-4 !py-3.5 !rounded-2xl" aria-label="Send"><SendHorizonal size={18} /></DCLButton>
      </form>
    </div>
  );
}
