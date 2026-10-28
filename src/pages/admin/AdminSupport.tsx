import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Inbox, SendHorizonal, ShieldCheck } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useAuth, useToast } from '../../lib/context';
import type { SupportMessage, Profile } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { Avatar, DCLButton, EmptyState, Card } from '../../components/ui';

/** Admin view of all private support threads — one thread per member, isolated by RLS for regular users; admin sees every thread here. */
export default function AdminSupport() {
  const { userId } = useAuth();
  const { push } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = getClient();
    c.from('support_messages').select('*').order('created_at', { ascending: true }).limit(500)
      .then(({ data }) => setMessages((data as SupportMessage[]) ?? []));
    const ch = c.channel('admin-support')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new as SupportMessage]);
      })
      .subscribe();
    return () => { c.removeChannel(ch); };
  }, []);

  const threads = useMemo(() => {
    const map = new Map<string, { userId: string; last: SupportMessage; unread: number }>();
    for (const m of messages) {
      const cur = map.get(m.user_id);
      const unread = m.sender_role === 'user' && !m.is_read ? 1 : 0;
      if (!cur || m.created_at > cur.last.created_at) map.set(m.user_id, { userId: m.user_id, last: m, unread: (cur?.unread ?? 0) + unread });
      else if (unread) cur.unread += unread;
    }
    return [...map.values()].sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [messages]);

  useEffect(() => {
    const missing = threads.map((t) => t.userId).filter((id) => !profiles[id]);
    if (!missing.length) return;
    getClient().from('profiles').select('*').in('id', missing).then(({ data }) => {
      if (!data) return;
      setProfiles((prev) => { const next = { ...prev }; for (const p of data as Profile[]) next[p.id] = p; return next; });
    });
  }, [threads, profiles]);

  useEffect(() => { if (!activeThread && threads.length) setActiveThread(threads[0].userId); }, [threads, activeThread]);
  useEffect(() => { window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); }, [activeThread, messages.length]);

  const threadMessages = messages.filter((m) => m.user_id === activeThread);

  useEffect(() => {
    if (!activeThread) return;
    getClient().rpc('support_mark_read', { p_thread_owner: activeThread }).then(() => undefined);
  }, [activeThread, threadMessages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !activeThread || sending) return;
    setSending(true);
    setBody('');
    try {
      const { error } = await getClient().rpc('admin_reply_support', { p_thread_owner: activeThread, p_body: text });
      if (error) {
        // fall back to direct insert if migration 0005 not applied yet
        const { error: insertError } = await getClient().from('support_messages').insert({ user_id: activeThread, sender_id: userId, sender_role: 'admin', body: text });
        if (insertError) throw insertError;
      }
    } catch (err) {
      setBody(text);
      push('error', 'Reply failed', friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-8.5rem)] min-h-[480px]">
      {/* thread list */}
      <div className="flex flex-col min-h-0">
        <h1 className="font-display text-lg font-bold text-zinc-50 flex items-center gap-2 mb-3"><Inbox size={18} className="text-amber-400" />Support <span className="gold-text">Inbox</span></h1>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {threads.length === 0 && <Card><EmptyState icon={<Inbox size={24} />} title="Inbox clear" body="Private member conversations appear here — isolated per member, visible only to the treasury." /></Card>}
          {threads.map((t) => {
            const p = profiles[t.userId];
            const name = p?.full_name || p?.email?.split('@')[0] || 'Member';
            const active = t.userId === activeThread;
            return (
              <button key={t.userId} onClick={() => setActiveThread(t.userId)} className={`w-full flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${active ? 'border-amber-500/45 bg-amber-500/10' : 'border-white/8 hover:border-white/15 bg-black/30'}`}>
                <Avatar name={name} color={p?.avatar_color} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-bold text-zinc-100 truncate">{name}</p>
                  <p className="text-[9px] text-zinc-500 truncate">{t.last.body}</p>
                </div>
                {t.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[9px] font-extrabold text-black flex items-center justify-center">{t.unread}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* active thread */}
      {activeThread ? (
        <div className="flex flex-col min-h-0 glass rounded-2xl border border-amber-500/20 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/6 bg-black/40">
            <ShieldCheck size={14} className="text-amber-400" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-zinc-100">{profiles[activeThread]?.full_name || profiles[activeThread]?.email}</p>
              <p className="text-[8.5px] text-zinc-600 font-mono">private thread · RLS-isolated from other members</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {threadMessages.map((m) => {
              const admin = m.sender_role === 'admin';
              return (
                <div key={m.id} className={`flex ${admin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-snug ${admin ? 'bg-gradient-to-br from-amber-500/25 to-gold-700/25 border border-amber-500/35 text-amber-50 rounded-br-md' : 'bg-[#1a1512] border border-white/8 text-zinc-100 rounded-bl-md'}`}>
                    {m.body}
                    <p className="text-[8px] text-zinc-600 font-mono mt-1">{admin ? 'You (Treasury)' : 'Member'} · {timeAgo(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-white/6 bg-black/40">
            <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Reply as the treasury…" className="field !rounded-xl" aria-label="Reply" />
            <DCLButton gold type="submit" loading={sending} className="!rounded-xl"><SendHorizonal size={17} /></DCLButton>
          </form>
        </div>
      ) : (
        <div className="hidden lg:flex items-center justify-center glass rounded-2xl border border-white/6">
          <p className="text-[12px] text-zinc-600">Select a thread to open the conversation.</p>
        </div>
      )}
    </div>
  );
}
